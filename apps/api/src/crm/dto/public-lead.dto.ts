import {
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { LeadOrigem } from "@nexiforma/database";

export class PublicCreateLeadDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  empresaNome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactoNome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  nif?: string;

  @IsOptional()
  @IsEnum(["WEBSITE", "REFERRAL", "FEIRA", "LINKEDIN", "TELEFONE", "IA", "OUTRO"])
  origem?: LeadOrigem;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorEstimadoCentavos?: number;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}
