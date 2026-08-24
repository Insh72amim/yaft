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
import { classifyInvestmentAssetType } from '@yaft/shared';

export interface ZerodhaHoldingItem {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  authorised_quantity?: number;
  opening_quantity?: number;
  dp_holding_quantity?: number;
  t1_quantity?: number;
  collateral_quantity?: number;
  collateral_type?: string;
  discrepancy?: boolean;
  average_price: number;
  last_price: number;
  close_price?: number;
  pnl?: number;
  day_change?: number;
  day_change_percentage?: number;
}

export interface ZerodhaHoldingsApiResponse {
  status: 'success' | 'error';
  data?: ZerodhaHoldingItem[];
  message?: string;
  error_type?: string;
}

export interface SyncZerodhaDto {
  enctoken?: string;
  apiKey?: string;
  accessToken?: string;
  saveCredential?: boolean;
}

@Injectable()
export class ZerodhaSyncService {
  private readonly logger = new Logger(ZerodhaSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsService: StatementCredentialsService,
  ) {}

  /**
   * Fetch live stock holdings snapshot directly from Zerodha Kite API / Session
   */
  async syncHoldings(
    userId: string,
    accountId: string,
    dto?: SyncZerodhaDto,
  ) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId, archived: false },
      include: { statementCredential: true },
    });

    if (!account) {
      throw new ForbiddenException('Account not found.');
    }

    if (!['STOCKS', 'INVESTMENT'].includes(account.type)) {
      throw new BadRequestException('Zerodha sync is only supported for Stock & Investment accounts.');
    }

    // Determine auth token
    let enctoken = dto?.enctoken?.trim();
    let apiKey = dto?.apiKey?.trim();
    let accessToken = dto?.accessToken?.trim();

    // If no credentials passed in request, retrieve saved credentials from Vault
    if (!enctoken && (!apiKey || !accessToken)) {
      if (account.statementCredential) {
        try {
          const decrypted = await this.credentialsService.getPassword(userId, accountId);
          if (decrypted) {
            if (decrypted.startsWith('enctoken:')) {
              enctoken = decrypted.replace('enctoken:', '').trim();
            } else if (decrypted.startsWith('kite:')) {
              const parts = decrypted.replace('kite:', '').split(':');
              apiKey = parts[0];
              accessToken = parts[1];
            } else {
              enctoken = decrypted.trim();
            }
          }
        } catch (err) {
          this.logger.error(`Failed to decrypt Zerodha credential for account ${accountId}`, err);
          throw new UnauthorizedException('Saved Zerodha credentials could not be decrypted. Please re-enter your credentials.');
        }
      }
    }

    if (!enctoken && (!apiKey || !accessToken)) {
      throw new BadRequestException(
        'Zerodha credentials required. Please provide an enctoken session cookie or Kite Connect API token.',
      );
    }

    // Fetch holdings from Zerodha API
    const holdings = await this.fetchFromZerodha({ enctoken, apiKey, accessToken });

    // Save credential in Vault if requested or not yet saved
    if (dto?.saveCredential !== false && (dto?.enctoken || (dto?.apiKey && dto?.accessToken))) {
      const plainCredential = dto.enctoken
        ? `enctoken:${dto.enctoken.trim()}`
        : `kite:${dto.apiKey?.trim()}:${dto.accessToken?.trim()}`;
      
      const encrypted = this.credentialsService.encrypt(accountId, plainCredential);
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

    // Atomically persist holdings snapshot in database
    const asOfDate = new Date();
    const importedAssetIds: string[] = [];
    let totalValuationMinor = 0;
    let totalInvestedMinor = 0;
    let totalPnlMinor = 0;

    await this.prisma.$transaction(
      async (tx) => {
        for (const item of holdings) {
          const totalQty = (item.quantity || 0) + (item.t1_quantity || 0);
          if (totalQty <= 0) continue;

          const symbol = item.tradingsymbol.toUpperCase().trim();
          const isin = item.isin?.trim() || null;
          const rawAssetType = classifyInvestmentAssetType(symbol);
          const assetType = rawAssetType === 'STOCK' || rawAssetType === 'ETF' || rawAssetType === 'MUTUAL_FUND'
            ? rawAssetType
            : 'STOCK';

          // Upsert Asset
          const bySymbol = await tx.asset.findUnique({ where: { symbol } });
          const byIsin = isin ? await tx.asset.findUnique({ where: { isin } }) : null;

          const existing = bySymbol ?? byIsin;
          const asset = existing
            ? await tx.asset.update({
                where: { id: existing.id },
                data: { symbol, name: symbol, isin: isin ?? existing.isin, type: assetType },
              })
            : await tx.asset.create({
                data: { symbol, name: symbol, isin, type: assetType },
              });

          importedAssetIds.push(asset.id);

          const avgPriceMinor = Math.round(Number(item.average_price || 0) * 100);
          const lastPriceMinor = Math.round(Number(item.last_price || item.close_price || item.average_price || 0) * 100);
          const prevCloseMinor = Math.round(Number(item.close_price || item.last_price || 0) * 100);
          const currentValMinor = Math.round(Number(item.last_price || item.average_price || 0) * totalQty * 100);
          const investedValMinor = Math.round(Number(item.average_price || 0) * totalQty * 100);
          const pnlMinor = Math.round(Number(item.pnl ?? ((item.last_price - item.average_price) * totalQty)) * 100);

          totalValuationMinor += currentValMinor;
          totalInvestedMinor += investedValMinor;
          totalPnlMinor += pnlMinor;

          const values = {
            quantity: new Prisma.Decimal(totalQty),
            availableQuantity: new Prisma.Decimal(item.quantity || 0),
            discrepantQuantity: new Prisma.Decimal(0),
            longTermQuantity: item.authorised_quantity ? new Prisma.Decimal(item.authorised_quantity) : null,
            pledgedQuantity: new Prisma.Decimal(item.collateral_quantity || 0),
            averagePrice: BigInt(avgPriceMinor),
            previousClosingPrice: BigInt(prevCloseMinor),
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

        // Delete any sold holdings that are no longer in Zerodha
        if (importedAssetIds.length > 0) {
          await tx.portfolioHolding.deleteMany({
            where: { accountId, assetId: { notIn: importedAssetIds } },
          });
        }

        // Update the account balance to match total current valuation
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
      message: `Successfully synchronized ${importedAssetIds.length} stock holdings from Zerodha.`,
      holdingsCount: importedAssetIds.length,
      totalValuation: totalValuationMinor / 100,
      totalInvested: totalInvestedMinor / 100,
      unrealizedPnl: totalPnlMinor / 100,
      asOfDate,
    };
  }

  /**
   * Internal helper to make authenticated HTTP call to Zerodha API
   */
  private async fetchFromZerodha(auth: {
    enctoken?: string;
    apiKey?: string;
    accessToken?: string;
  }): Promise<ZerodhaHoldingItem[]> {
    let url = 'https://kite.zerodha.com/oms/portfolio/holdings';
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
    };

    if (auth.enctoken) {
      headers['Authorization'] = `enctoken ${auth.enctoken}`;
    } else if (auth.apiKey && auth.accessToken) {
      url = 'https://api.kite.trade/portfolio/holdings';
      headers['Authorization'] = `token ${auth.apiKey}:${auth.accessToken}`;
      headers['X-Kite-Version'] = '3';
    }

    try {
      const response = await fetch(url, { method: 'GET', headers });
      const body = (await response.json()) as ZerodhaHoldingsApiResponse;

      if (!response.ok || body.status !== 'success') {
        const errorMsg = body.message || `Zerodha API returned HTTP ${response.status}`;
        this.logger.error(`Zerodha holdings API call failed: ${errorMsg}`);
        
        if (response.status === 403 || response.status === 401 || errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('session')) {
          throw new UnauthorizedException(
            'Your Zerodha session / token has expired or is invalid. Please update your enctoken in Vault.',
          );
        }
        throw new BadRequestException(`Zerodha Sync Failed: ${errorMsg}`);
      }

      if (!Array.isArray(body.data)) {
        return [];
      }

      return body.data;
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
        throw err;
      }
      this.logger.error('Failed to communicate with Zerodha API', err);
      throw new BadRequestException(`Could not connect to Zerodha API: ${err.message || 'Network error'}`);
    }
  }
}
