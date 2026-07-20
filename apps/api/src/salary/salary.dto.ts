import { IsDateString, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class ManualSalaryDto {
  @IsString() @MaxLength(128) employer!: string;
  @IsDateString() payPeriod!: string;
  @IsNumberString() grossEarnings!: string;
  @IsNumberString() grossDeductions!: string;
  @IsNumberString() netPay!: string;

  @IsOptional() @IsNumberString() tax?: string;
  @IsOptional() @IsNumberString() pf?: string;
}
