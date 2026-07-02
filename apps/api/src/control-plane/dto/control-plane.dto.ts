import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Length, Matches, Min } from "class-validator";

const STATUSES = ["ACTIVE", "SUSPENDED", "TRIAL", "ARCHIVED"] as const;
const PLAN_CODES = ["starter", "pro", "enterprise"] as const;

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
  @IsIn(PLAN_CODES)
  planCode?: (typeof PLAN_CODES)[number];

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

export class ImpersonateDto {
  @IsUUID()
  targetUserId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsBoolean()
  readOnly?: boolean;
}
