import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

const STATUSES = ["ACTIVE", "SUSPENDED", "TRIAL", "ARCHIVED"] as const;

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
