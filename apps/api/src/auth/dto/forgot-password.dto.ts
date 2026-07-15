import { IsEmail, IsOptional, IsString, Length, MinLength } from "class-validator";

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

export class PreviewPasswordResetDto {
  @IsString()
  @MinLength(16)
  token!: string;

  /** Referência encriptada do utilizador (query `u` do link). */
  @IsOptional()
  @IsString()
  userRef?: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

export class TenantResetPasswordDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;

  @IsOptional()
  @IsString()
  userRef?: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  /** Obrigatório se a conta tiver MFA activo. */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  mfaCode?: string;
}

export class PlatformResetPasswordDto {
  @IsString()
  @MinLength(16)
  token!: string;

  @IsOptional()
  @IsString()
  userRef?: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
