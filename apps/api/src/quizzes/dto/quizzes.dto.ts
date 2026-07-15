import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

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
}

export class SubmitQuizDto {
  @IsObject()
  respostas!: Record<string, string>;
}
