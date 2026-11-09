import { AccountType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min, IsNumber } from 'class-validator';

export class CreateAccountDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEnum(AccountType) type!: AccountType;
  @IsOptional() @IsString() @Length(1, 80) institution?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsInt() openingBalance?: number;
  @IsOptional() @IsInt() @Min(0) creditLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) statementDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number;
  @IsOptional() @IsString() parentAccountId?: string | null;

  // Loan properties
  @IsOptional() @IsString() loanStartDate?: string;
  @IsOptional() @IsInt() @Min(1) loanPrincipal?: number;
  @IsOptional() @IsNumber() @Min(0.01) @Max(100) loanInterestRate?: number;
  @IsOptional() @IsInt() @Min(1) loanEmiAmount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) loanEmiDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(600) loanTermMonths?: number;

  // Recurring Deposit properties
  @IsOptional() @IsString() rdStartDate?: string;
  @IsOptional() @IsInt() @Min(1) rdMonthlyAmount?: number;
  @IsOptional() @IsNumber() @Min(0.01) @Max(100) rdInterestRate?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) rdDepositDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(600) rdTermMonths?: number;
  @IsOptional() rdAutoIncrease?: boolean;
}

export class DeleteAccountDto {
  @IsString() @Length(2, 80) confirmationName!: string;
}

export class ClearTransactionsDto {
  @IsString() @Length(2, 80) confirmationName!: string;
  @IsOptional() @IsInt() @Min(1) @Max(3650) days?: number;
}

export class UpdateAccountDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() @Length(1, 80) institution?: string;
  @IsOptional() @IsInt() openingBalance?: number;
  @IsOptional() @IsInt() @Min(0) creditLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) statementDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number;
  @IsOptional() @IsString() parentAccountId?: string | null;
  @IsOptional() @IsBoolean() emailSyncEnabled?: boolean;
}

export class CreateTransactionDto {
  @IsString() @Length(1, 120) description!: string;
  @IsInt() amount!: number;
  @IsString() transactionDate!: string;
}

