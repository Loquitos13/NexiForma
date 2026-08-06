import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import type { NifConfirmTipo } from "../vies.util";

export class ValidarNifDto {
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  nif!: string;

  @IsIn(["pessoa", "empresa"])
  tipo!: NifConfirmTipo;
}
