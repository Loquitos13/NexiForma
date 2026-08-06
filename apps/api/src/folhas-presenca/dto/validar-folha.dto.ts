import { IsString, MaxLength, MinLength } from "class-validator";

export class ValidarFolhaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nomeAssinatura!: string;
}
