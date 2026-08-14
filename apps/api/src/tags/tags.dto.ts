import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateTagDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  budgetLimit?: number;
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  budgetLimit?: number;
}

export class AssignTagsDto {
  @IsArray()
  @IsString({ each: true })
  transactionIds: string[];

  @IsArray()
  @IsString({ each: true })
  tagIds: string[];

  @IsOptional()
  @IsEnum(['ADD', 'REMOVE', 'SET'])
  action?: 'ADD' | 'REMOVE' | 'SET';
}

export class AutoApplyTagDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  categoryId?: string;
}
