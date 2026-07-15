import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class TenantLoginDto {
  @IsString()
  @MinLength(1)
  tenantSlug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  /** Sessão refresh prolongada (cookie HttpOnly). */
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
