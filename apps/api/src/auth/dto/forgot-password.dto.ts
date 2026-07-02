import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class TenantForgotPasswordDto {
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @IsEmail()
  email!: string;
}

export class PlatformForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class TenantResetPasswordDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class PlatformResetPasswordDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
