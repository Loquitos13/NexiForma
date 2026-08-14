import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateFormadorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nomeCompleto!: string;

  @IsString()
  @Length(9, 9)
  nif!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(9)
  @MaxLength(48)
  telefone!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  morada!: string;
}
