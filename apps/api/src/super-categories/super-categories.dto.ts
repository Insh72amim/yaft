import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreateSuperCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(CategoryType)
  @IsOptional()
  kind?: CategoryType;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}

export class UpdateSuperCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(CategoryType)
  @IsOptional()
  kind?: CategoryType;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;
}
