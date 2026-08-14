import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { GoalStatus } from '@prisma/client';

export class CreateGoalDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Target amount in rupees (will be converted to paise server-side) */
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  targetAmount: number;

  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  targetAmount?: number;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}

export class CreateContributionDto {
  /**
   * Amount in rupees (positive = deposit, negative = withdrawal).
   * We allow negative contributions so the user can record a partial withdrawal
   * from the earmarked savings without deleting the goal.
   */
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
