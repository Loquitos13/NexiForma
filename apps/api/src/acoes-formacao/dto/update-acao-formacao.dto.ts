import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

/** Aceites no DTO; EM_CURSO/CONCLUIDA são rejeitados no serviço (fluxos dedicados). */
const ESTADOS = ["PLANEADA", "EM_CURSO", "CONCLUIDA", "CANCELADA"] as const;

export class UpdateAcaoFormacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== "")
  @IsDateString()
  prazoConclusaoLms?: string | null;

  @IsOptional()
  @IsIn(ESTADOS)
  estado?: (typeof ESTADOS)[number];

  /** Snapshot documental desta edição (contrato/declaração moldados a horas/valor). */
  @IsOptional()
  @IsObject()
  configuracaoMatricula?: Record<string, unknown> | null;

  @IsOptional()
  @IsIn(["FINANCIADA", "AUTO_FINANCIADA"])
  tipoFinanciamento?: "FINANCIADA" | "AUTO_FINANCIADA";
}
