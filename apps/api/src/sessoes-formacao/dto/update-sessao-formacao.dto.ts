import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

const ESTADOS = ["AGENDADA", "REALIZADA", "CANCELADA"] as const;

export class UpdateSessaoFormacaoDto {
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: (typeof ESTADOS)[number];

  @IsOptional()
  @IsUUID()
  formadorId?: string | null;

  @IsOptional()
  @IsUUID()
  moduloUnidadeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  modalidade?: string;

  @IsOptional()
  @IsBoolean()
  lmsAtivo?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  zoomMeetingId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  minutosPresencaMin?: number;

  @IsOptional()
  @IsBoolean()
  formadorPresente?: boolean | null;
}
