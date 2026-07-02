import { BadRequestException } from "@nestjs/common";

export type DadosEmitenteInput = {
  nomeEmpresa?: string | null;
  moradaFiscal?: string | null;
  nifEmitente?: string | null;
  iban?: string | null;
  bicSwift?: string | null;
  emailGestor?: string | null;
  capitalSocial?: string | null;
  consRegCom?: string | null;
};

export type DadosClienteInput = {
  nome?: string | null;
  nif?: string | null;
  moradaFiscal?: string | null;
};

const CAMPOS_EMITENTE: Array<{ key: keyof DadosEmitenteInput; label: string }> = [
  { key: "nomeEmpresa", label: "nome comercial completo" },
  { key: "moradaFiscal", label: "morada fiscal" },
  { key: "nifEmitente", label: "número de contribuinte (NIF)" },
  { key: "iban", label: "IBAN" },
  { key: "bicSwift", label: "BIC/SWIFT" },
  { key: "emailGestor", label: "email do gestor" },
  { key: "capitalSocial", label: "capital social" },
  { key: "consRegCom", label: "Conservatória do Registo Comercial" },
];

const CAMPOS_CLIENTE: Array<{ key: keyof DadosClienteInput; label: string }> = [
  { key: "nome", label: "nome comercial completo" },
  { key: "nif", label: "número de contribuinte (NIF)" },
  { key: "moradaFiscal", label: "morada fiscal" },
];

export function normalizarIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function normalizarBic(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function validarIban(iban: string): boolean {
  const v = normalizarIban(iban);
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v);
}

export function validarBic(bic: string): boolean {
  const v = normalizarBic(bic);
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v);
}

export function validarNifPt(nif: string): boolean {
  return /^\d{9}$/.test(nif.replace(/\s/g, ""));
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function listarCamposEmitenteEmFalta(dados: DadosEmitenteInput): string[] {
  const emFalta: string[] = [];
  for (const { key, label } of CAMPOS_EMITENTE) {
    if (!dados[key]?.toString().trim()) emFalta.push(label);
  }
  return emFalta;
}

export function listarCamposClienteEmFalta(dados: DadosClienteInput): string[] {
  const emFalta: string[] = [];
  for (const { key, label } of CAMPOS_CLIENTE) {
    if (!dados[key]?.toString().trim()) emFalta.push(label);
  }
  return emFalta;
}

export function assertDadosEmitenteCompletos(dados: DadosEmitenteInput): void {
  const emFalta = listarCamposEmitenteEmFalta(dados);
  if (emFalta.length) {
    throw new BadRequestException(
      `Dados de faturação incompletos: ${emFalta.join(", ")}. Configure em CRM → Faturação.`,
    );
  }
  const nif = dados.nifEmitente!.replace(/\s/g, "");
  if (!validarNifPt(nif)) {
    throw new BadRequestException("NIF do emitente inválido (9 dígitos).");
  }
  if (!validarIban(dados.iban!)) {
    throw new BadRequestException("IBAN inválido.");
  }
  if (!validarBic(dados.bicSwift!)) {
    throw new BadRequestException("BIC/SWIFT inválido (8 ou 11 caracteres).");
  }
  if (!validarEmail(dados.emailGestor!)) {
    throw new BadRequestException("Email do gestor inválido.");
  }
}

export function assertDadosClienteCompletos(dados: DadosClienteInput): void {
  const emFalta = listarCamposClienteEmFalta(dados);
  if (emFalta.length) {
    throw new BadRequestException(
      `Dados do cliente incompletos: ${emFalta.join(", ")}. Actualize a ficha da entidade cliente.`,
    );
  }
  if (!validarNifPt(dados.nif!)) {
    throw new BadRequestException("NIF do cliente inválido (9 dígitos).");
  }
}
