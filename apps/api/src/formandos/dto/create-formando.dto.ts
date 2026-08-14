import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { SigoFormandoMetadataDto } from "./sigo-formando-metadata.dto";

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

  @IsEmail()
  @MaxLength(320)
  email!: string;

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
  @IsUUID()
  entidadeClienteId?: string | null;

  /** Dados obrigatórios para submissão SOAP SIGO. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SigoFormandoMetadataDto)
  sigo?: SigoFormandoMetadataDto;
}
