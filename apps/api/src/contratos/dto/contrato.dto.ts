import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";
import type { ContratoComercialEstado } from "@nexiforma/database";

const ESTADOS = ["RASCUNHO", "VIGENTE", "CANCELADO"] as const;

export class CreateContratoDto {
  @IsUUID()
  entidadeClienteId!: string;

  @IsString()
  @Length(2, 200)
  titulo!: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  codigo?: string;

  /** Template CRM registado, ou omitir/null para documento personalizado. */
  @IsOptional()
  @IsString()
  @Length(1, 96)
  templateId?: string | null;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorCentavos?: number;

  @IsOptional()
  @IsUUID()
  propostaId?: string;

  @IsOptional()
  @IsString()
  notasInternas?: string;
}

export class UpdateContratoDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  titulo?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string | null;

  @IsOptional()
  @IsDateString()
  dataInicio?: string | null;

  @IsOptional()
  @IsDateString()
  dataFim?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorCentavos?: number;

  @IsOptional()
  @IsEnum(ESTADOS)
  estado?: ContratoComercialEstado;

  @IsOptional()
  @IsString()
  notasInternas?: string | null;
}

export class ContratoPreviewDto {
  @IsOptional()
  @IsString()
  bodyHtml?: string;
}

export class ContratoPdfDto extends ContratoPreviewDto {}
