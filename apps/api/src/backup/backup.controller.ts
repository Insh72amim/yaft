import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { BackupService } from './backup.service';

@Controller('backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('export')
  async exportBackup(
    @CurrentUser('id') userId: string,
    @Body('passphrase') passphrase: string,
    @Res() res: Response,
  ) {
    if (!passphrase || typeof passphrase !== 'string') {
      throw new BadRequestException('Backup passphrase is required.');
    }

    const backupBuffer = await this.backupService.exportBackup(userId, passphrase);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `yaft-backup-${dateStr}.yaft-backup`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', backupBuffer.length.toString());
    res.send(backupBuffer);
  }

  @Post('restore')
  @UseInterceptors(FileInterceptor('file'))
  async restoreBackup(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('passphrase') passphrase: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('A .yaft-backup file must be provided.');
    }
    if (!passphrase || typeof passphrase !== 'string') {
      throw new BadRequestException('The backup passphrase must be provided.');
    }

    const stats = await this.backupService.restoreBackup(userId, passphrase, file.buffer);
    return {
      success: true,
      message: 'Backup restored successfully.',
      ...stats,
    };
  }
}
