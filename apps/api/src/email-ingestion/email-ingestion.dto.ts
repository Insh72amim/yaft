import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SaveEmailConfigDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsBoolean()
  @IsOptional()
  tls?: boolean;

  @IsString()
  password!: string;

  @IsBoolean()
  @IsOptional()
  autoSync?: boolean;
}

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
