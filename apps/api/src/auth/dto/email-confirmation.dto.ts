import { IsEmail, IsString, MinLength } from "class-validator";

export class ConfirmEmailDto {
  @IsString()
  @MinLength(32)
  token!: string;
}

export class ResendEmailConfirmationDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  tenantSlug!: string;
}
