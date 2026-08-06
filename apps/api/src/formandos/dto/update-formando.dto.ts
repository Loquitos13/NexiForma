import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SigoFormandoMetadataDto } from "./sigo-formando-metadata.dto";

export class UpdateFormandoDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nome?: string;

  @IsOptional()
  @IsString()
  @MinLength(9)
  @MaxLength(9)
  nif?: string;

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
  @MaxLength(32)
  telefone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  morada?: string | null;

  /** Cliente CRM a associar; `null` remove a associação. */
  @IsOptional()
  @IsUUID()
  entidadeClienteId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => SigoFormandoMetadataDto)
  sigo?: SigoFormandoMetadataDto | null;
}
