import { IsDateString, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

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
}
