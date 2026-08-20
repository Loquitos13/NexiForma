import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateCursoDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codigoUfcd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  designacao?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  cargaHoras?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  modalidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objetivos?: string;

  /** Predefinição documental (universais + inscrição) para novas acções deste curso. */
  @IsOptional()
  @IsObject()
  configuracaoMatricula?: Record<string, unknown> | null;

  /** Progressão LMS: true = sequencial, false = livre. */
  @IsOptional()
  @IsBoolean()
  lmsProgressaoSequencial?: boolean;
}
