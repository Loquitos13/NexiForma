import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateFormandoDto {
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
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  emailPresenca?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefone?: string;
}
