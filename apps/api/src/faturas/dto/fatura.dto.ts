import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class FaturaLinhaDto {
  @IsString()
  @MaxLength(500)
  descricao!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantidade?: number;

  @IsInt()
  @Min(0)
  precoUnitCentavos!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaIva?: number;

  /** Obrigatório quando taxaIva = 0 (códigos AT M01–M99). */
  @IsOptional()
  @IsString()
  @MaxLength(8)
  codigoIsencaoIva?: string | null;
}

export class CreateFaturaDto {
  @IsUUID()
  entidadeClienteId!: string;

  @IsOptional()
  @IsUUID()
  serieId?: string;

  @IsOptional()
  @IsDateString()
  dataVencimento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  destinatarioNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  destinatarioNif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  destinatarioMorada?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaturaLinhaDto)
  linhas!: FaturaLinhaDto[];
}

export class UpdateFaturaDto {
  @IsOptional()
  @IsDateString()
  dataVencimento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  destinatarioNome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  destinatarioNif?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  destinatarioMorada?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notas?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  retencaoCentavos?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaturaLinhaDto)
  linhas?: FaturaLinhaDto[];
}

export class UpdateConfigFaturacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomeEmpresa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moradaFiscal?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  nifEmitente?: string;

  @IsOptional()
  @IsString()
  @MaxLength(34)
  iban?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(11)
  bicSwift?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailGestor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  capitalSocial?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  consRegCom?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  seriePadraoCodigo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaIvaPadrao?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  regimeIva?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  atSubutilizador?: string | null;

  /** Nova password WFA - nunca devolvida pela API; só actualiza se preenchida. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  atWfaPassword?: string;

  @IsOptional()
  comunicacaoAtiva?: boolean;

  @IsOptional()
  comunicacaoAutomatica?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  softwareCertificado?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  atCertificadoRef?: string | null;
}

export class UpdateSerieFaturacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  codigoValidacaoAt?: string | null;
}

export class SolicitarAnulacaoFaturaDto {
  @IsString()
  @MaxLength(2000)
  motivo!: string;
}

export class AnularFaturaDto {
  @IsString()
  @MaxLength(2000)
  motivo!: string;
}

export class RejeitarPedidoAnulacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  respostaMotivo?: string;
}

export class EnviarFaturaEmailDto {
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;
}
