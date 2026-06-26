import { IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateQuizPerguntaDto {
  @IsUUID()
  moduloId!: string;

  @IsString()
  enunciado!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;

  @IsObject()
  opcoes!: Array<{ id: string; texto: string; correta?: boolean }>;

  @IsOptional()
  @IsInt()
  @Min(1)
  pontos?: number;
}

export class SubmitQuizDto {
  @IsObject()
  respostas!: Record<string, string>;
}
