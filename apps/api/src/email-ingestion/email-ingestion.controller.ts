import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmailIngestionService } from './email-ingestion.service';
import { ParseEmailSnippetDto } from './email-ingestion.dto';

@Controller('email-ingestion')
@UseGuards(JwtAuthGuard)
export class EmailIngestionController {
  constructor(private readonly emailIngestionService: EmailIngestionService) {}

  @Post('parse-snippet')
  async parseSnippet(@CurrentUser() user: { id: string }, @Body() dto: ParseEmailSnippetDto) {
    return this.emailIngestionService.parseSnippet(user.id, dto);
  }

  @Get('logs')
  async listLogs(@CurrentUser() user: { id: string }) {
    return this.emailIngestionService.listLogs(user.id);
  }
}
