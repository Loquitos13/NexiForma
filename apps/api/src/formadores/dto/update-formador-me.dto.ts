import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Auto-edição do formador (sem alterar NIF/email da conta). */
export class UpdateFormadorMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nomeCompleto?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  emailPresenca?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  telefone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  morada?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ccNumero?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ccpNumero?: string | null;

  @IsOptional()
  @IsString()
  ccValidade?: string | null;

  @IsOptional()
  @IsString()
  ccpValidade?: string | null;
}
