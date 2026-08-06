import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateFormadorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nomeCompleto?: string;

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
  @MaxLength(48)
  telefone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  morada?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ccNumero?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ccpNumero?: string;

  @IsOptional()
  @IsDateString()
  ccValidade?: string;

  @IsOptional()
  @IsDateString()
  ccpValidade?: string;
}
