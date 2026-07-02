import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

/** Campos de conteúdo editáveis na proposta (override dos padrões do tenant). */
export class PropostaConteudoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitulo?: string | null;

  @IsOptional()
  @IsString()
  apresentacaoEmpresa?: string | null;

  @IsOptional()
  @IsString()
  enquadramento?: string | null;

  @IsOptional()
  @IsString()
  objetivos?: string | null;

  @IsOptional()
  @IsString()
  conteudosProgramaticos?: string | null;

  @IsOptional()
  @IsString()
  metodologia?: string | null;

  @IsOptional()
  @IsString()
  destinatarios?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  duracaoTexto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  localTexto?: string | null;

  @IsOptional()
  @IsString()
  beneficios?: string | null;

  @IsOptional()
  @IsString()
  condicoesComerciais?: string | null;

  @IsOptional()
  @IsString()
  porqueEscolher?: string | null;

  @IsOptional()
  @IsString()
  proximosPassos?: string | null;
}

export class UpdateConfigPropostaDto {
  @IsOptional()
  @IsString()
  apresentacaoEmpresa?: string | null;

  @IsOptional()
  @IsString()
  enquadramentoPadrao?: string | null;

  @IsOptional()
  @IsString()
  objetivosPadrao?: string | null;

  @IsOptional()
  @IsString()
  conteudosProgramaticosPadrao?: string | null;

  @IsOptional()
  @IsString()
  metodologiaPadrao?: string | null;

  @IsOptional()
  @IsString()
  destinatariosPadrao?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  duracaoTextoPadrao?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  localTextoPadrao?: string | null;

  @IsOptional()
  @IsString()
  beneficiosPadrao?: string | null;

  @IsOptional()
  @IsString()
  condicoesComerciaisPadrao?: string | null;

  @IsOptional()
  @IsString()
  porqueEscolherPadrao?: string | null;

  @IsOptional()
  @IsString()
  proximosPassosPadrao?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  validadeDiasPadrao?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomeContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  emailContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefoneContacto?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string | null;
}
