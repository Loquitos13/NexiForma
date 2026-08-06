import { IsString, MaxLength, MinLength } from "class-validator";

export class AprovarFolhaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nomeAssinatura!: string;
}
