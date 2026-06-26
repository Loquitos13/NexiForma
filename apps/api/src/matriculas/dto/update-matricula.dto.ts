import { IsIn, IsOptional } from "class-validator";

const ESTADOS = ["ATIVA", "DESISTENCIA", "CONCLUSAO"] as const;

export class UpdateMatriculaDto {
  @IsIn(ESTADOS)
  estado!: (typeof ESTADOS)[number];
}
