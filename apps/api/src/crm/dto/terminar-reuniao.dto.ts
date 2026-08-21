import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class TerminarReuniaoCrmDto {
  @IsOptional()
  @IsBoolean()
  registarNota?: boolean;

  @IsOptional()
  @IsBoolean()
  importarTranscricao?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  contexto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  situacaoActual?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  dorNecessidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  orcamentoTiming?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decisor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  proximoPassoNota?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  notasLivres?: string;
}
