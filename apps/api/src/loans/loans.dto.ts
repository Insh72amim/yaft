import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateLoanDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsDateString()
  startDate: string; // ISO date

  @IsInt()
  @IsPositive()
  principal: number; // in paise (integer)

  @IsInt()
  @IsPositive()
  emiAmount: number; // in paise

  @IsOptional()
  @IsInt()
  @IsPositive()
  termMonths?: number;

  @IsPositive()
  interestRate: number; // annual percent, e.g. 9.5

  @IsOptional()
  @IsInt()
  emiDay?: number; // day of month for EMI due
}
