import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from "class-validator";
import { BILLING_ADDON_CODES, BILLING_PLAN_CODES } from "@nexiforma/shared";

const STATUSES = ["ACTIVE", "SUSPENDED", "TRIAL", "ARCHIVED"] as const;
const SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"] as const;

export class CreateTenantDto {
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug: apenas minúsculas, números e hífens (ex.: acme-formacao).",
  })
  slug!: string;

  @IsString()
  @Length(2, 200)
  legalName!: string;

  @IsString()
  @Length(9, 9)
  @Matches(/^\d{9}$/, { message: "NIF português: 9 dígitos." })
  nif!: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(BILLING_PLAN_CODES)
  planCode?: (typeof BILLING_PLAN_CODES)[number];

  /** Módulos activos (obrigatório se planCode=modular). */
  @IsOptional()
  @IsArray()
  @IsIn(BILLING_ADDON_CODES, { each: true })
  customAddons?: (typeof BILLING_ADDON_CODES)[number][];

  @IsOptional()
  @IsString()
  billingEmail?: string;

  /** Gestor inicial (opcional). */
  @IsOptional()
  @IsString()
  managerEmail?: string;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  managerPassword?: string;

  @IsOptional()
  @IsString()
  managerDisplayName?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @Length(2, 64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug: apenas minúsculas, números e hífens.",
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @Length(9, 9)
  @Matches(/^\d{9}$/, { message: "NIF português: 9 dígitos." })
  nif?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTenantSubscriptionDto {
  @IsIn(BILLING_PLAN_CODES)
  planCode!: (typeof BILLING_PLAN_CODES)[number];

  @IsOptional()
  @IsArray()
  @IsIn(BILLING_ADDON_CODES, { each: true })
  customAddons?: (typeof BILLING_ADDON_CODES)[number][];

  @IsOptional()
  @IsIn(SUBSCRIPTION_STATUSES)
  status?: (typeof SUBSCRIPTION_STATUSES)[number];
}

export class UpdateTenantStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}

export class CreateSubscriptionKeyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxActiveUsersSnapshot?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInDays?: number;
}

export class InviteManagerDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  displayName?: string;
}

export class ImpersonateDto {
  @IsUUID()
  targetUserId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;
}

/** Perfil do super-admin (Control Plane). Email obrigatório; restantes campos opcionais. */
export class UpdatePlatformMeDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  newPassword?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  currentPassword?: string;
}

export class ResetTenantUserPasswordDto {
  @IsOptional()
  @IsBoolean()
  forceChangeOnLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsString()
  @Length(8, 128)
  customPassword?: string;
}

export class CreateTenantAccessKeyDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  label?: string;
}

export class RedeemTenantAccessKeyDto {
  @IsString()
  @Length(20, 128)
  key!: string;
}

export class CreateTenantMatriculaDto {
  @IsUUID()
  turmaId!: string;

  @IsUUID()
  formandoId!: string;
}

export class FixFormandoAccessDto {
  @IsOptional()
  @IsUUID()
  turmaId?: string;

  @IsOptional()
  @IsUUID()
  linkUserId?: string;
}
