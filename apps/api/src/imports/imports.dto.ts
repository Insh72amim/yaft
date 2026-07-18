import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadStatementDto {
  @IsOptional() @IsString() @MaxLength(128) pdfPassword?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' ? true : value === false || value === 'false' ? false : value)
  @IsBoolean()
  rememberPassword?: boolean;
}

export class UpdateStagedDto {
  @IsOptional() @IsBoolean() include?: boolean;
  @IsOptional() @IsString() categoryId?: string;
}
