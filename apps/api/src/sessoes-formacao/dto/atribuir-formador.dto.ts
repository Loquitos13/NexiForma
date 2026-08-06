import { IsOptional, IsUUID, ValidateIf } from "class-validator";

export class AtribuirFormadorCronogramaDto {
  @IsUUID()
  cronogramaId!: string;

  /** Se indicado, só aplica às sessões desta turma. */
  @IsOptional()
  @IsUUID()
  turmaId?: string;

  /** `null` remove o formador de todas as sessões. */
  @ValidateIf((_, v) => v != null)
  @IsUUID()
  formadorId!: string | null;
}

export class NotificarAtribuicaoFormadorDto {
  @IsUUID()
  cronogramaId!: string;

  @IsOptional()
  @IsUUID()
  formadorId?: string;
}
