import { IsUUID } from "class-validator";

export class CreateMatriculaDto {
  @IsUUID()
  turmaId!: string;

  @IsUUID()
  formandoId!: string;
}
