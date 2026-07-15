import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateEntidadeClienteDto {
  @IsString()
  @Length(9, 9)
  @Matches(/^\d{9}$/)
  nif!: string;

  @IsString()
  @Length(2, 200)
  nome!: string;

  @IsString()
  @Length(5, 500)
  moradaFiscal!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsBoolean()
  isParceiro?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  descontoPercent?: number;
}

export class UpdateEntidadeClienteDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  nome?: string;

  @IsOptional()
  @IsString()
  @Length(5, 500)
  moradaFiscal?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsBoolean()
  isParceiro?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  descontoPercent?: number | null;
}
