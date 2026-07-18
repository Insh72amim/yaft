import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateStagedDto {
  @IsOptional() @IsBoolean() include?: boolean;
  @IsOptional() @IsString() categoryId?: string;
}
