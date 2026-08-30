import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ParseEmailSnippetDto {
  @IsString()
  snippet!: string;

  @IsString()
  @IsOptional()
  senderOrSubject?: string;

  @IsString()
  @IsOptional()
  targetAccountId?: string;
}

export class GoogleOAuthCallbackDto {
  @IsString()
  code!: string;

  @IsString()
  @IsOptional()
  redirectUri?: string;
}

export class SyncGmailDto {
  @IsNumber()
  @IsOptional()
  days?: number;

  @IsString()
  @IsOptional()
  emailId?: string;

  @IsString()
  @IsOptional()
  accountScope?: 'ALL' | 'ALL_BANKS' | 'ALL_CARDS' | 'CUSTOM';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetAccountIds?: string[];
}
