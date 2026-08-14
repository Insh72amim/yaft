import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailIngestionService } from './email-ingestion.service';
import { ParseEmailSnippetDto, SaveEmailConfigDto } from './email-ingestion.dto';

@Controller('email-ingestion')
@UseGuards(JwtAuthGuard)
export class EmailIngestionController {
  constructor(private readonly emailIngestionService: EmailIngestionService) {}

  @Get('config')
  async getConfig(@CurrentUser() user: { id: string }) {
    return this.emailIngestionService.getConfig(user.id);
  }

  @Post('config')
  async saveConfig(@CurrentUser() user: { id: string }, @Body() dto: SaveEmailConfigDto) {
    return this.emailIngestionService.saveConfig(user.id, dto);
  }

  @Post('parse-snippet')
  async parseSnippet(@CurrentUser() user: { id: string }, @Body() dto: ParseEmailSnippetDto) {
    return this.emailIngestionService.parseSnippet(user.id, dto);
  }

  @Post('sync')
  async syncInbox(@CurrentUser() user: { id: string }) {
    return this.emailIngestionService.syncInbox(user.id);
  }

  @Get('logs')
  async listLogs(@CurrentUser() user: { id: string }) {
    return this.emailIngestionService.listLogs(user.id);
  }
}
