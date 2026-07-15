import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import type { SigoPerfisAcesso } from "@nexiforma/shared";

export class UpdateSigoTenantConfigDto {
  @IsBoolean()
  integracaoAtiva!: boolean;

  @IsOptional()
  @IsIn(["soap", "http"])
  protocolo?: "soap" | "http";

  @IsString()
  @MinLength(9)
  @MaxLength(9)
  nifEntidade!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  codigoEntidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  denominacaoEntidade?: string;

  /** Nova API key HTTP (só enviada ao guardar; nunca devolvida em claro). */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  baseUrlOverride?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  wsdlUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  soapEndpoint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  soapUsername?: string | null;

  /** Password WS-Security (UsernameToken) – nunca devolvida em claro. */
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(512)
  soapPassword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipAutorizado?: string | null;

  @IsOptional()
  @IsIn(["CONTINENTE", "MADEIRA", "ACORES"])
  regiaoPortal?: "CONTINENTE" | "MADEIRA" | "ACORES";

  @IsOptional()
  @IsObject()
  perfisAcesso?: Partial<SigoPerfisAcesso>;
}
