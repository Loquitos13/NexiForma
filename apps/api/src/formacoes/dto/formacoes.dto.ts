import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateFormacaoDto {
  @IsString()
  @MaxLength(280)
  titulo!: string;

  @IsInt()
  @Min(1)
  horas!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ufcd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  enquadramento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  objetivos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  metodoEnsino?: string;

  /** presencial | b-learning | e-learning */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  modalidade?: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}

export class UpdateFormacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  titulo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  horas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ufcd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  enquadramento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  objetivos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  metodoEnsino?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  modalidade?: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;
}

export class AgendaSessoesDto {
  @IsString()
  dataInicio!: string;

  @IsString()
  dataFim!: string;

  @IsString()
  @MaxLength(5)
  horaInicio!: string;

  @IsString()
  @MaxLength(5)
  horaFim!: string;

  @IsOptional()
  @IsBoolean()
  repete?: boolean;

  /** 0=domingo … 6=sábado (Date.getDay()) */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  diasRepete?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  local?: string;

  @IsEnum(["ABERTAS", "FECHADAS"] as const)
  inscricoes!: "ABERTAS" | "FECHADAS";
}

export class CreateFormacaoAcaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  codigoInterno?: string;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @ValidateNested()
  @Type(() => AgendaSessoesDto)
  sessoes!: AgendaSessoesDto;
}

export class UpdateFormacaoAcaoDto {
  @IsOptional()
  @IsEnum(["ABERTAS", "FECHADAS"] as const)
  inscricoes?: "ABERTAS" | "FECHADAS";

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  titulo?: string;
}
