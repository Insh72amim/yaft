import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UnifiedImportUploadDto {
  @IsString() @MaxLength(64) kind!: string;
  @IsString() @MaxLength(64) source!: string;

  @IsOptional() @IsString() @MaxLength(128) accountId?: string;
  @IsOptional() @IsString() @MaxLength(128) pdfPassword?: string;
  @IsOptional() @IsString() @MaxLength(64) salaryType?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' ? true : value === false || value === 'false' ? false : value)
  @IsBoolean()
  rememberPassword?: boolean;
}

