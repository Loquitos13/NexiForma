import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import type { TenantUserRole } from "@nexiforma/database";

const ROLES: TenantUserRole[] = [
  "ADMIN",
  "COORDENADOR",
  "FORMADOR",
  "FORMANDO",
  "FINANCEIRO",
  "COMERCIAL",
];

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsIn(ROLES)
  role!: TenantUserRole;

  @IsString()
  @MaxLength(120)
  displayName!: string;

  /** Obrigatório quando `role` é FORMANDO — ficha DGERT para inscrições. */
  @ValidateIf((o: InviteUserDto) => o.role === "FORMANDO")
  @IsString()
  @MinLength(9)
  @MaxLength(9)
  nif?: string;

  @ValidateIf((o: InviteUserDto) => o.role === "FORMANDO")
  @IsOptional()
  @IsString()
  @MaxLength(48)
  telefone?: string;

  /** Matricular já na turma (opcional). */
  @ValidateIf((o: InviteUserDto) => o.role === "FORMANDO")
  @IsOptional()
  @IsUUID()
  turmaId?: string;
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
  @IsBoolean()
  mfaRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;
}

export class EnforceMfaDto {
  @IsArray()
  @IsUUID("4", { each: true })
  userIds!: string[];
}
