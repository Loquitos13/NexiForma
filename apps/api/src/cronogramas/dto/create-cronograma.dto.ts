import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class CreateCronogramaDto {
  @IsUUID()
  acaoFormacaoId!: string;

  /** Se omitido, usa última versão + 1 para a acção. */
  @IsOptional()
  @IsInt()
  @Min(1)
  versao?: number;
}
