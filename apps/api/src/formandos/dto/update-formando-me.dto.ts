import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Actualização de perfil pelo próprio formando - email nunca aceite aqui. */
export class UpdateFormandoMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nome?: string;

  @IsOptional()
  @IsString()
  @MinLength(9)
  @MaxLength(9)
  nif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefone?: string;
}
