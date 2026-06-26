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
import type { PropostaEstado } from "@nexiforma/database";

const ESTADOS = ["RASCUNHO", "ENVIADA", "ACEITE", "REJEITADA", "CANCELADA"] as const;

export class CreatePropostaDto {
  @IsUUID()
  entidadeClienteId!: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  codigo?: string;

  @IsString()
  @Length(2, 200)
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorCentavos?: number;

  @IsOptional()
  @IsDateString()
  validadeAte?: string;

  @IsOptional()
  @IsUUID()
  cursoId?: string;

  @IsOptional()
  @IsString()
  notasInternas?: string;
}

export class UpdatePropostaDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  valorCentavos?: number;

  @IsOptional()
  @IsEnum(ESTADOS)
  estado?: PropostaEstado;

  @IsOptional()
  @IsDateString()
  validadeAte?: string;

  @IsOptional()
  @IsUUID()
  cursoId?: string;

  @IsOptional()
  @IsString()
  notasInternas?: string;
}
