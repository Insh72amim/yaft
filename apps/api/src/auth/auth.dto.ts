import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
