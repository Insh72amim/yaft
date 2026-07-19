import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { S3Service } from '../s3/s3.service';
import { StatementCredentialsService } from './statement-credentials.service';

@Global()
@Module({ imports: [ConfigModule], providers: [PrismaService, S3Service, StatementCredentialsService], exports: [PrismaService, S3Service, StatementCredentialsService] })
export class CommonModule {}
