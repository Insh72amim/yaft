import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRecurringDepositDto {
  @IsString()
  startDate!: string;

  @IsInt()
  @Min(100)
  monthlyAmount!: number; // In paise (e.g. 500000 for ₹5,000)

  @IsNumber()
  @Min(0.01)
  @Max(100)
  interestRate!: number; // In percent per annum (e.g. 7.1)

  @IsInt()
  @Min(1)
  @Max(31)
  depositDay!: number; // Day of the month for monthly deposit (1-31)

  @IsInt()
  @Min(1)
  @Max(600)
  termMonths!: number; // Total tenure in months (e.g. 12, 24, 36)

  @IsOptional()
  @IsBoolean()
  autoIncrease?: boolean; // Whether balance auto-increases on/after depositDay

  @IsOptional()
  @IsString()
  sourceAccountId?: string;
}

export class UpdateRecurringDepositSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoIncrease?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  depositDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  interestRate?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  monthlyAmount?: number;

  @IsOptional()
  @IsString()
  sourceAccountId?: string | null;
}
