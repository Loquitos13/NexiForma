import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateCursoDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  codigoUfcd?: string;

  @IsString()
  @MaxLength(280)
  designacao!: string;

  @IsInt()
  @Min(1)
  cargaHoras!: number;

  /** Valores típicos: presencial · b-learning · e-learning */
  @IsString()
  @MaxLength(32)
  modalidade!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  objetivos?: string;
}
