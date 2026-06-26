import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

/** Registo inicial de «aluno» (perfil DGERT antes de User/conta LMS). */
export class CreateFormandoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nome!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(32)
  nif!: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  emailPresenca?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(48)
  telefone?: string | null;

  @IsOptional()
  @IsUUID()
  entidadeClienteId?: string | null;
}
