import { IsEmail, IsString, MinLength } from "class-validator";

export class TenantForgotPasswordDto {
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class PlatformForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
