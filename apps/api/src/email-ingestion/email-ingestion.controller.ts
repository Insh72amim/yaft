import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { GoogleGmailService } from './google-gmail.service';
import { EmailIngestionService } from './email-ingestion.service';
import { GoogleOAuthCallbackDto, ParseEmailSnippetDto, SyncGmailDto } from './email-ingestion.dto';

@Controller('email-ingestion')
@UseGuards(JwtAuthGuard)
export class EmailIngestionController {
  constructor(
    private readonly emailIngestionService: EmailIngestionService,
    private readonly googleGmailService: GoogleGmailService,
  ) {}

  @Post('parse-snippet')
  async parseSnippet(@CurrentUser() user: { id: string }, @Body() dto: ParseEmailSnippetDto) {
    return this.emailIngestionService.parseSnippet(user.id, dto);
  }

  @Get('logs')
  async listLogs(@CurrentUser() user: { id: string }) {
    return this.emailIngestionService.listLogs(user.id);
  }

  // Google OAuth & Gmail Ingestion Endpoints
  @Get('google/auth-url')
  async getGoogleAuthUrl(@CurrentUser() user: { id: string }, @Query('redirectUri') redirectUri?: string) {
    return this.googleGmailService.getAuthUrl(user.id, redirectUri);
  }

  @Post('google/callback')
  async handleGoogleCallback(@CurrentUser() user: { id: string }, @Body() dto: GoogleOAuthCallbackDto) {
    return this.googleGmailService.handleCallback(user.id, dto.code, dto.redirectUri);
  }

  @Get('google/config')
  async getGoogleConfig(@CurrentUser() user: { id: string }) {
    return this.googleGmailService.getConfig(user.id);
  }

  @Post('google/sync')
  async syncGmailInbox(@CurrentUser() user: { id: string }, @Body() body?: SyncGmailDto) {
    return this.googleGmailService.syncGmail(user.id, body);
  }

  @Delete('google/disconnect')
  async disconnectGoogle(@CurrentUser() user: { id: string }, @Query('emailId') emailId?: string) {
    return this.googleGmailService.disconnect(user.id, emailId);
  }
}
