import { AccountType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateAccountDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEnum(AccountType) type!: AccountType;
  @IsOptional() @IsString() @Length(1, 80) institution?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsInt() openingBalance?: number;
  @IsOptional() @IsInt() @Min(0) creditLimit?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) statementDay?: number;
  @IsOptional() @IsInt() @Min(1) @Max(31) dueDay?: number;
}

export class DeleteAccountDto {
  @IsString() @Length(2, 80) confirmationName!: string;
}
