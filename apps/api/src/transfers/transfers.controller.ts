import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { TransfersService } from './transfers.service';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Post('reconcile')
  reconcile(@CurrentUser() user: { id: string }) {
    return this.transfers.reconcileTransfers(user.id);
  }

  @Get('suggestions')
  findSuggestions(@CurrentUser() user: { id: string }) {
    return this.transfers.findPotentialMatches(user.id);
  }

  @Post('link')
  link(@CurrentUser() user: { id: string }, @Body() body: { txId1: string; txId2: string }) {
    return this.transfers.manualLink(user.id, body.txId1, body.txId2);
  }

  @Delete(':transferGroupId')
  @HttpCode(204)
  unlink(@CurrentUser() user: { id: string }, @Param('transferGroupId') transferGroupId: string) {
    return this.transfers.unlinkGroup(user.id, transferGroupId);
  }
}
