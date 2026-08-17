import { IsDateString, IsIn, IsOptional, IsString, MaxLength, IsUUID } from "class-validator";

const TIPOS_FINANCIAMENTO = ["FINANCIADA", "AUTO_FINANCIADA"] as const;

export class CreateAcaoFormacaoDto {
  @IsUUID()
  cursoId!: string;

  @IsString()
  @MaxLength(80)
  codigoInterno!: string;

  @IsString()
  @MaxLength(280)
  titulo!: string;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  estado?: string;

  @IsOptional()
  @IsIn(TIPOS_FINANCIAMENTO)
  tipoFinanciamento?: (typeof TIPOS_FINANCIAMENTO)[number];
}
