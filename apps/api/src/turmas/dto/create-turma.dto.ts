import { IsString, MaxLength, MinLength } from "class-validator";
import { IsUUID } from "class-validator";

export class CreateTurmaDto {
  @IsUUID()
  acaoFormacaoId!: string;

  /** Código curto dentro da acção (ex. T-A) */
  @IsString()
  @MinLength(1)
  @MaxLength(48)
  codigo!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;
}
