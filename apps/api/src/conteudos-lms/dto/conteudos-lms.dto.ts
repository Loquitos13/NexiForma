import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

const TIPOS = ["VIDEO", "PDF", "SCORM", "TEXTO", "QUIZ", "WEBINAR"] as const;

export class CreateModuloConteudoDto {
  @IsUUID()
  cursoId!: string;

  @IsString()
  titulo!: string;

  @IsIn(TIPOS)
  tipo!: (typeof TIPOS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsString()
  urlOuRef?: string;

  @IsOptional()
  @IsString()
  conteudoHtml?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoMin?: number;

  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  notaMinima?: number;

  @IsOptional()
  @IsString()
  prerequisitoModuloId?: string;

  @IsOptional()
  @IsUUID()
  moduloUnidadeId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateModuloUnidadeDto {
  @IsUUID()
  cursoId!: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsString()
  titulo!: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  cargaHoras?: number;

  @IsOptional()
  @IsUUID()
  formadorId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  notaMinima?: number;
}

export class UpdateModuloUnidadeDto {
  @IsOptional()
  @IsString()
  codigo?: string | null;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  cargaHoras?: number | null;

  @IsOptional()
  @IsUUID()
  formadorId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  notaMinima?: number | null;
}

export class UpdateProgressoModuloDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentual?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  pontuacao?: number;
}
