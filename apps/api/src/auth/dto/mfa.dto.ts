import { IsBoolean, IsIn, IsOptional, IsString, Length } from "class-validator";
import { MFA_APP_CODES } from "@nexiforma/shared";

export class VerifyMfaDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class SetupMfaConfirmDto {
  @IsString()
  @Length(6, 6)
  code!: string;

  @IsIn(MFA_APP_CODES)
  mfaApp!: (typeof MFA_APP_CODES)[number];
}

export class EnrollMfaSetupDto {
  @IsString()
  mfaToken!: string;
}

export class EnrollMfaConfirmDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsIn(MFA_APP_CODES)
  mfaApp!: (typeof MFA_APP_CODES)[number];

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
