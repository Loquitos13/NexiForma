import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export class FaturaTemplateCoresDto {
  /** solid = uma cor no hero; gradient = 3 cores. Obrigatório ao enviar templateCores. */
  @IsIn(["solid", "gradient"])
  headerMode!: "solid" | "gradient";

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  headerFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  headerVia?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  headerTo?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  accent?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  surface?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR)
  border?: string;
}

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

  /** Desconto comercial na linha (%). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descontoPercent?: number;

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
  @MaxLength(500)
  moradaCarga?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moradaDescarga?: string | null;

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
  @MaxLength(500)
  moradaCarga?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  moradaDescarga?: string | null;

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

  /**
   * Aceite explícito da Licença Anexo II (Contrato adesão webservice AT).
   * Obrigatório para activar comunicação AT / invocar webservices.
   */
  @IsOptional()
  aceitarLicencaAtWs?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  softwareCertificado?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  atCertificadoRef?: string | null;

  /** Cores do template PDF/HTML da fatura (hex #RRGGBB). */
  @IsOptional()
  @ValidateNested()
  @Type(() => FaturaTemplateCoresDto)
  templateCores?: FaturaTemplateCoresDto;
}

export class UpdateSerieFaturacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  codigoValidacaoAt?: string | null;
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
