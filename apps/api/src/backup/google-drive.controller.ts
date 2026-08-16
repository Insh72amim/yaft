import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { GoogleDriveService } from './google-drive.service';

@Controller('backup/drive')
@UseGuards(JwtAuthGuard)
export class GoogleDriveController {
  constructor(private readonly googleDriveService: GoogleDriveService) {}

  @Get('auth-url')
  async getAuthUrl(
    @CurrentUser('id') userId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    return this.googleDriveService.getAuthUrl(userId, redirectUri);
  }

  @Post('callback')
  async handleCallback(
    @CurrentUser('id') userId: string,
    @Body('code') code: string,
    @Body('redirectUri') redirectUri?: string,
  ) {
    if (!code) {
      throw new BadRequestException('Authorization code is required.');
    }
    return this.googleDriveService.handleCallback(userId, code, redirectUri);
  }

  @Get('config')
  async getConfig(@CurrentUser('id') userId: string) {
    return this.googleDriveService.getConfig(userId);
  }

  @Patch('settings')
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body('autoBackupEnabled') autoBackupEnabled?: boolean,
    @Body('autoPassphrase') autoPassphrase?: string,
  ) {
    return this.googleDriveService.updateSettings(userId, autoBackupEnabled, autoPassphrase);
  }

  @Post('upload')
  async uploadBackup(
    @CurrentUser('id') userId: string,
    @Body('passphrase') passphrase?: string,
  ) {
    return this.googleDriveService.uploadBackup(userId, passphrase);
  }

  @Get('revisions')
  async listRevisions(@CurrentUser('id') userId: string) {
    return this.googleDriveService.listRevisions(userId);
  }

  @Post('restore')
  async restoreFromRevision(
    @CurrentUser('id') userId: string,
    @Body('passphrase') passphrase: string,
    @Body('revisionId') revisionId?: string,
  ) {
    if (!passphrase) {
      throw new BadRequestException('Passphrase is required to restore cloud backup.');
    }
    return this.googleDriveService.restoreFromRevision(userId, passphrase, revisionId);
  }

  @Delete('disconnect')
  async disconnect(@CurrentUser('id') userId: string) {
    return this.googleDriveService.disconnect(userId);
  }
}
