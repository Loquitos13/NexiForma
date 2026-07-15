import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { BILLING_ADDON_CODES, BILLING_PLAN_CODES } from "@nexiforma/shared";

export class SalesContactDto {
  @IsString()
  @Length(2, 120)
  nome!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  empresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  telefone?: string;

  @IsOptional()
  @IsIn([...BILLING_PLAN_CODES, "custom", "modules_only"])
  planoInteresse?: (typeof BILLING_PLAN_CODES)[number] | "custom" | "modules_only";

  @IsOptional()
  @IsArray()
  @IsIn(BILLING_ADDON_CODES, { each: true })
  addonsInteresse?: (typeof BILLING_ADDON_CODES)[number][];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mensagem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  origem?: string;
}
