import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { PropostaEstado } from "@nexiforma/database";
import { PropostaLinhaDto } from "./proposta-linha.dto";
import { PropostaConteudoDto } from "./proposta-config.dto";

const ESTADOS = ["RASCUNHO", "ENVIADA", "ACEITE", "REJEITADA", "CANCELADA"] as const;

export class CreatePropostaDto extends PropostaConteudoDto {
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

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PropostaLinhaDto)
  linhas?: PropostaLinhaDto[];
}

export class UpdatePropostaDto extends PropostaConteudoDto {
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
  validadeAte?: string | null;

  @IsOptional()
  @IsUUID()
  cursoId?: string | null;

  @IsOptional()
  @IsString()
  notasInternas?: string | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PropostaLinhaDto)
  linhas?: PropostaLinhaDto[];
}
