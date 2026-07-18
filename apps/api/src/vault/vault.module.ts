import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { VaultController } from './vault.controller';

@Module({
  imports: [CommonModule],
  controllers: [VaultController],
})
export class VaultModule {}
