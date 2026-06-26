import { IsIn, IsInt, IsOptional, IsUUID, Min } from "class-validator";

const EVENTOS = ["join", "leave"] as const;

export class CreateLmsEventoDto {
  @IsUUID()
  matriculaId!: string;

  @IsOptional()
  @IsUUID()
  sessaoFormacaoId?: string;

  @IsIn(EVENTOS)
  evento!: (typeof EVENTOS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  duracaoSegundos?: number;
}
