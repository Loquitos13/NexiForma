import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  MaxLength,
} from "class-validator";

const REUNIAO_AUDIENCIA_ROLES = [
  "COMERCIAL",
  "FORMADOR",
  "FINANCEIRO",
  "COORDENADOR",
] as const;

export class CreateInteraccaoDto {
  @IsOptional()
  @IsEnum(["REUNIAO", "TELEFONE", "EMAIL", "NOTA", "OUTRO"])
  tipo?: "REUNIAO" | "TELEFONE" | "EMAIL" | "NOTA" | "OUTRO";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;

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

  @IsOptional()
  @IsUUID()
  entidadeClienteId?: string;

  @IsOptional()
  @IsUUID()
  leadComercialId?: string;

  @IsOptional()
  @IsString()
  agendadoPara?: string;

  @IsOptional()
  @IsString()
  agendadoFim?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  participantesIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(REUNIAO_AUDIENCIA_ROLES, { each: true })
  audienciaRoles?: (typeof REUNIAO_AUDIENCIA_ROLES)[number][];
}

export class UpdateInteraccaoDto extends CreateInteraccaoDto {}
