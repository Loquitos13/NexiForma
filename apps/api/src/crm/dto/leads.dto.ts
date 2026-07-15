import {
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import type { LeadEstado, LeadOrigem } from "@nexiforma/database";

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codigo?: string;

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
  @IsUUID()
  atribuidoUserId?: string;

  @IsOptional()
  @IsUUID()
  entidadeClienteId?: string;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  empresaNome?: string;

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
  @IsEnum(["NOVO", "CONTACTADO", "QUALIFICADO", "CONVERTIDO", "PERDIDO"])
  estado?: LeadEstado;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorEstimadoCentavos?: number;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsUUID()
  atribuidoUserId?: string | null;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;
}

export class MarcarLeadPerdidoDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}

export class ConverterLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(9)
  nif?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome?: string;
}

export class CriarPropostaFromLeadDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorCentavos?: number;

  @IsOptional()
  @IsUUID()
  cursoId?: string;
}
