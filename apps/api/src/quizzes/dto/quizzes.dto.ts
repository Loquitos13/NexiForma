import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

const QUIZ_TIPOS = ["MULTIPLA", "VF", "ABERTA"] as const;

export class QuizOpcaoDto {
  @IsUUID()
  id!: string;

  @IsString()
  texto!: string;

  @IsOptional()
  @IsBoolean()
  correta?: boolean;
}

export class CreateQuizPerguntaDto {
  @IsUUID()
  moduloId!: string;

  @IsString()
  enunciado!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizOpcaoDto)
  opcoes!: QuizOpcaoDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pontos?: number;

  @IsOptional()
  @IsIn(QUIZ_TIPOS)
  tipo?: (typeof QUIZ_TIPOS)[number];

  @IsOptional()
  @IsString()
  explicacao?: string | null;
}

export class UpdateQuizPerguntaDto {
  @IsOptional()
  @IsString()
  enunciado?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizOpcaoDto)
  opcoes?: QuizOpcaoDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pontos?: number;

  @IsOptional()
  @IsIn(QUIZ_TIPOS)
  tipo?: (typeof QUIZ_TIPOS)[number];

  @IsOptional()
  @IsString()
  explicacao?: string | null;
}

export class SubmitQuizDto {
  @IsObject()
  respostas!: Record<string, string>;
}
