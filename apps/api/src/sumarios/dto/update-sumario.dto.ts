import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateSumarioDto {
  @IsString()
  @MinLength(10)
  @MaxLength(12000)
  conteudo!: string;
}
