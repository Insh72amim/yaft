import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  AccountDocumentsService,
  MAX_ACCOUNT_DOCUMENT_BYTES,
  MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD,
} from './account-documents.service';

function encodedFilename(name: string): string {
  return encodeURIComponent(name).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

@Controller('accounts/:accountId/documents')
@UseGuards(JwtAuthGuard)
export class AccountDocumentsController {
  constructor(private readonly documents: AccountDocumentsService) {}

  @Get()
  list(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
  ) {
    return this.documents.list(user.id, accountId);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('documents', MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD, {
    limits: { fileSize: MAX_ACCOUNT_DOCUMENT_BYTES, files: MAX_ACCOUNT_DOCUMENTS_PER_UPLOAD },
  }))
  upload(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ) {
    return this.documents.upload(user.id, accountId, files);
  }

  @Get(':documentId/content')
  async content(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const document = await this.documents.content(user.id, accountId, documentId);
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="document"; filename*=UTF-8''${encodedFilename(document.name)}`,
      'Content-Length': String(document.buffer.length),
      'Content-Type': document.mimeType,
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(document.buffer);
  }

  @Get(':documentId/download')
  async download(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const document = await this.documents.content(user.id, accountId, documentId);
    response.set({
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="document"; filename*=UTF-8''${encodedFilename(document.name)}`,
      'Content-Length': String(document.buffer.length),
      'Content-Type': document.mimeType,
      'X-Content-Type-Options': 'nosniff',
    });
    response.send(document.buffer);
  }

  @Patch(':documentId')
  rename(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('documentId') documentId: string,
    @Body() dto: { name: string },
  ) {
    return this.documents.rename(user.id, accountId, documentId, dto.name);
  }

  @Delete(':documentId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.remove(user.id, accountId, documentId);
  }
}
