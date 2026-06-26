import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

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
}
