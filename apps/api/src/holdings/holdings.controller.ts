import { BadRequestException, Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { HoldingsService } from './holdings.service';

@Controller('holdings')
@UseGuards(JwtAuthGuard)
export class HoldingsController {
  constructor(private readonly holdings: HoldingsService) {}

  @Post(':accountId/upload')
  @UseInterceptors(FileInterceptor('holdings', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadHoldings(
    @CurrentUser() user: { id: string },
    @Param('accountId') accountId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('A holdings export file is required.');
    return this.holdings.uploadHoldings(user.id, accountId, file);
  }
}
