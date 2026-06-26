import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

/** Abre folha de presença para uma sessão e pré-preenche matrículas activas da turma. */
export class CreateFolhaPresencaDto {
  @IsUUID()
  sessaoId!: string;

  @IsUUID()
  turmaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  origem?: string;
}
