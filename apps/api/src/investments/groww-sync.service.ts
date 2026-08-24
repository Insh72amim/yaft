import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { StatementCredentialsService } from '../common/statement-credentials.service';
import { parseGrowwHoldingsXlsx } from './groww-holdings-parser';

export interface SyncGrowwDto {
  token?: string;
  saveCredential?: boolean;
}

@Injectable()
export class GrowwSyncService {
  private readonly logger = new Logger(GrowwSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsService: StatementCredentialsService,
  ) {}

  /**
   * Fetch live mutual fund holdings snapshot directly from Groww API
   */
  async syncHoldings(
    userId: string,
    accountId: string,
    dto?: SyncGrowwDto,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      include: { statementCredential: true },
    });

    if (!account) {
      throw new ForbiddenException('Account not found.');
    }

    if (!['MUTUAL_FUND', 'STOCKS'].includes(account.type)) {
      throw new BadRequestException('Groww sync is only supported for Mutual Fund & Investment accounts.');
    }

    // Determine auth token
    let token = dto?.token?.trim();

    // If no token passed in request, retrieve saved token from Vault
    if (!token && account.statementCredential) {
      try {
        const decrypted = await this.credentialsService.getPassword(userId, accountId);
        if (decrypted) {
          token = decrypted.replace(/^groww:/i, '').trim();
        }
      } catch (err) {
        this.logger.error(`Failed to decrypt Groww credential for account ${accountId}`, err);
        throw new UnauthorizedException('Saved Groww credentials could not be decrypted. Please re-enter your token.');
      }
    }

    if (!token) {
      throw new BadRequestException(
        'Groww session token required. Please provide your Groww authentication token.',
      );
    }

    // Support pasting full cURL command or raw headers
    let cleanToken = token;
    let checksum = 'NDJ6enEjIyM5S0JvZ2RqNzlSZzQrd1dPOGRvcnpmQnJzVXpmNkxDS2Naayt1U1BKYnYwenBmRXRGVjl5NUhhdmhaTkJGeVlUVXlGRU9Rdk1kTjgzOGtsUXEvS2xKQmJGNmEzRFNUMENqaVprUVZqN0lmcz0=';

    if (token.includes('curl ') || token.includes('x-user-campaign:') || token.includes('x-user-campaign:')) {
      const matchToken = token.match(/x-user-campaign[:\s'"]+(Bearer\s+[A-Za-z0-9-_.]+)/i) ||
        token.match(/Authorization[:\s'"]+(Bearer\s+[A-Za-z0-9-_.]+)/i) ||
        token.match(/(eyJ[A-Za-z0-9-_.]+)/);
      if (matchToken) {
        cleanToken = matchToken[1].startsWith('Bearer ') ? matchToken[1] : `Bearer ${matchToken[1]}`;
      }
      const matchChecksum = token.match(/x-request-checksum[:\s'"]+([A-Za-z0-9+/=]+)/i);
      if (matchChecksum) {
        checksum = matchChecksum[1];
      }
    } else {
      cleanToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    // Fetch holdings report buffer from Groww API
    const excelBuffer = await this.fetchReportFromGroww(cleanToken, checksum);

    // Parse Excel sheet
    const holdings = await parseGrowwHoldingsXlsx(excelBuffer);
    if (!holdings.length) {
      throw new BadRequestException('Groww returned 0 mutual fund holdings for this account.');
    }

    // Save credential in Vault if requested
    if (dto?.saveCredential !== false && dto?.token) {
      const encrypted = this.credentialsService.encrypt(accountId, `groww:${cleanToken}`);
      await this.prisma.statementCredential.upsert({
        where: { accountId },
        create: {
          accountId,
          ciphertext: encrypted.ciphertext as any,
          iv: encrypted.iv as any,
          authTag: encrypted.authTag as any,
          keyVersion: encrypted.keyVersion,
        },
        update: {
          ciphertext: encrypted.ciphertext as any,
          iv: encrypted.iv as any,
          authTag: encrypted.authTag as any,
          keyVersion: encrypted.keyVersion,
        },
      });
    }

    // Atomically persist holdings in database
    const asOfDate = new Date();
    const importedAssetIds: string[] = [];
    let totalValuationMinor = 0;
    let totalInvestedMinor = 0;
    let totalPnlMinor = 0;

    await this.prisma.$transaction(
      async (tx) => {
        for (const item of holdings) {
          const name = item.assetName.trim();
          const symbol = name;

          // Upsert Asset
          const bySymbol = await tx.asset.findUnique({ where: { symbol } });
          const asset = bySymbol
            ? await tx.asset.update({
                where: { id: bySymbol.id },
                data: { symbol, name, type: item.assetType },
              })
            : await tx.asset.create({
                data: { symbol, name, type: item.assetType },
              });

          importedAssetIds.push(asset.id);

          const qty = item.quantity;
          const avgPriceMinor = item.averagePriceMinor || 0;
          const currentValMinor = item.currentValueMinor || Math.round(avgPriceMinor * qty);
          const pnlMinor = item.unrealizedPnlMinor || (currentValMinor - Math.round(avgPriceMinor * qty));
          const investedValMinor = Math.round(avgPriceMinor * qty);

          totalValuationMinor += currentValMinor;
          totalInvestedMinor += investedValMinor;
          totalPnlMinor += pnlMinor;

          const values = {
            quantity: new Prisma.Decimal(qty),
            availableQuantity: new Prisma.Decimal(qty),
            discrepantQuantity: new Prisma.Decimal(0),
            longTermQuantity: null,
            pledgedQuantity: new Prisma.Decimal(0),
            averagePrice: BigInt(avgPriceMinor),
            previousClosingPrice: null,
            currentValue: BigInt(currentValMinor),
            unrealizedPnl: BigInt(pnlMinor),
            asOfDate,
          };

          await tx.portfolioHolding.upsert({
            where: { accountId_assetId: { accountId, assetId: asset.id } },
            create: { accountId, assetId: asset.id, ...values },
            update: values,
          });
        }

        // Delete any sold / exited holdings that are no longer in Groww
        if (importedAssetIds.length > 0) {
          await tx.portfolioHolding.deleteMany({
            where: { accountId, assetId: { notIn: importedAssetIds } },
          });
        }

        // Update account openingBalance to match current total valuation
        await tx.account.update({
          where: { id: accountId },
          data: {
            openingBalance: BigInt(totalValuationMinor),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      success: true,
      message: `Successfully synchronized ${importedAssetIds.length} mutual fund holdings from Groww.`,
      holdingsCount: importedAssetIds.length,
      totalValuation: totalValuationMinor / 100,
      totalInvested: totalInvestedMinor / 100,
      unrealizedPnl: totalPnlMinor / 100,
      asOfDate,
    };
  }

  /**
   * Internal helper to make authenticated HTTP call to Groww API and get the Excel report buffer
   */
  private async fetchReportFromGroww(token: string, checksum?: string): Promise<Buffer> {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://groww.in/v1/api/portfolio/v3/transaction/report/holdings_report?as_on_date=${today}`;

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'x-user-campaign': token,
      Authorization: token,
      'x-app-id': 'growwWeb',
      'x-platform': 'web',
      'x-device-type': 'desktop',
      'x-device-id': '9a20fb09-d150-5e7a-b31a-e23544b8cdc8',
      'x-device-id-v2': '9a20fb09-d150-5e7a-b31a-e23544b8cdc8',
      'x-request-id': 'e9785ca5-9c22-4867-b8ed-5b8540c9d02b',
      'x-request-checksum':
        checksum ||
        'NDJ6enEjIyM5S0JvZ2RqNzlSZzQrd1dPOGRvcnpmQnJzVXpmNkxDS2Naayt1U1BKYnYwenBmRXRGVjl5NUhhdmhaTkJGeVlUVXlGRU9Rdk1kTjgzOGtsUXEvS2xKQmJGNmEzRFNUMENqaVprUVZqN0lmcz0=',
      'x-primary-target': 'td=1,au=1,ld=4',
      'x-secondary-target': 'td=2,au=2,ld=3',
      'x-target-version': '0',
      Origin: 'https://groww.in',
      Referer: 'https://groww.in/user/profile/report',
      Accept: 'application/json, text/plain, */*',
    };

    try {
      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        let errorMsg = `Groww API returned HTTP ${response.status}`;
        try {
          const body = await response.json();
          if (body?.errorMessage?.message) {
            errorMsg = body.errorMessage.message;
          } else if (body?.message) {
            errorMsg = body.message;
          }
        } catch {
          // Response was not JSON
        }

        if (
          response.status === 401 ||
          response.status === 403 ||
          errorMsg.toLowerCase().includes('login') ||
          errorMsg.toLowerCase().includes('token')
        ) {
          throw new UnauthorizedException(
            'Your Groww session has expired or is invalid. Please copy a fresh token/cURL from Groww and try again.',
          );
        }

        throw new BadRequestException(`Groww Sync Failed: ${errorMsg}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error('Failed to communicate with Groww API', err);
      throw new BadRequestException(`Could not connect to Groww API: ${err.message || 'Network error'}`);
    }
  }
}
