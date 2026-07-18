import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class UpsertVaultEntryDto {
  @IsOptional() @IsString() @Matches(/^\d{9,18}$/, { message: 'Account number must be 9–18 digits.' })
  accountNumber?: string;

  @IsOptional() @IsString() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC must be 11 characters, e.g. SBIN0001234.' })
  ifsc?: string;

  @IsOptional() @IsString() @Length(1, 50)
  upiId?: string;

  @IsOptional() @IsString() @Matches(/^\d{13,19}$/, { message: 'Card number must be 13–19 digits (no spaces).' })
  cardNumber?: string;

  @IsOptional() @IsString() @Matches(/^\d{3,4}$/, { message: 'CVV must be 3 or 4 digits.' })
  cvv?: string;

  @IsOptional() @IsInt() @Min(1) @Max(12)
  cardExpiryMm?: number;

  @IsOptional() @IsInt() @Min(25) @Max(99)
  cardExpiryYy?: number;

  @IsOptional() @IsString() @Length(1, 20)
  cardNetwork?: string;
}
