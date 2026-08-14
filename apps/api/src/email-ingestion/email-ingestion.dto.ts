import { IsOptional, IsString } from 'class-validator';

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
