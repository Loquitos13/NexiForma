import { IsEmail, IsOptional, IsString, Length, Matches } from "class-validator";

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
}
