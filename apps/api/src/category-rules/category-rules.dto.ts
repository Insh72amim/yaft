import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { MatchField, MatchType } from '@prisma/client';

export class CreateCategoryRuleDto {
  @IsString()
  @IsNotEmpty()
  pattern!: string;

  @IsEnum(MatchField)
  @IsOptional()
  matchField?: MatchField;

  @IsEnum(MatchType)
  @IsOptional()
  matchType?: MatchType;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}

export class UpdateCategoryRuleDto {
  @IsString()
  @IsOptional()
  pattern?: string;

  @IsEnum(MatchField)
  @IsOptional()
  matchField?: MatchField;

  @IsEnum(MatchType)
  @IsOptional()
  matchType?: MatchType;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;
}
