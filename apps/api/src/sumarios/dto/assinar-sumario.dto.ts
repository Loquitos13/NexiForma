import { IsString, MaxLength, MinLength } from "class-validator";

export class AssinarSumarioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nomeAssinatura!: string;
}
