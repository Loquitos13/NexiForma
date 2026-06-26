import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { TenantUserRole } from "@nexiforma/database";

const ROLES: TenantUserRole[] = ["ADMIN", "COORDENADOR", "FORMADOR", "FINANCEIRO", "COMERCIAL"];

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsIn(ROLES)
  role!: TenantUserRole;

  @IsString()
  @MaxLength(120)
  displayName!: string;
}

export class AcceptInviteDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(ROLES)
  role?: TenantUserRole;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}
