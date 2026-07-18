import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { StatementCredentialsService } from './statement-credentials.service';

@Global()
@Module({ providers: [PrismaService, StatementCredentialsService], exports: [PrismaService, StatementCredentialsService] })
export class CommonModule {}
