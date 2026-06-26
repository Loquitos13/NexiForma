import { IsDateString, IsOptional, IsString, MaxLength, IsUUID } from "class-validator";

export class CreateAcaoFormacaoDto {
  @IsUUID()
  cursoId!: string;

  @IsString()
  @MaxLength(80)
  codigoInterno!: string;

  @IsString()
  @MaxLength(280)
  titulo!: string;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  estado?: string;
}
