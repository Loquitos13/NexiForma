import { formatDatePt } from "@/lib/calendar-date";

export type PropostaEstado = "RASCUNHO" | "ENVIADA" | "ACEITE" | "REJEITADA" | "CANCELADA";

export type LeadEstado = "NOVO" | "CONTACTADO" | "QUALIFICADO" | "CONVERTIDO" | "PERDIDO";
export type LeadOrigem = "WEBSITE" | "REFERRAL" | "FEIRA" | "LINKEDIN" | "TELEFONE" | "IA" | "OUTRO";

export function fmtEuro(cents: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return formatDatePt(iso);
}

export function propostaEstadoLabel(estado: string) {
  const map: Record<string, string> = {
    RASCUNHO: "Rascunho",
    ENVIADA: "Enviada",
    ACEITE: "Aceite",
    REJEITADA: "Rejeitada",
    CANCELADA: "Cancelada",
  };
  return map[estado] ?? estado;
}

export function propostaEstadoVariant(
  estado: string,
): "default" | "blue" | "green" | "red" | "yellow" {
  const map: Record<string, "default" | "blue" | "green" | "red" | "yellow"> = {
    RASCUNHO: "default",
    ENVIADA: "blue",
    ACEITE: "green",
    REJEITADA: "red",
    CANCELADA: "yellow",
  };
  return map[estado] ?? "default";
}

export function generatePropostaCodigo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PROP-${y}${m}-${r}`;
}

export function generateLeadCodigo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LEAD-${y}${m}-${r}`;
}

export function leadEstadoLabel(estado: string) {
  const map: Record<string, string> = {
    NOVO: "Novo",
    CONTACTADO: "Contactado",
    QUALIFICADO: "Qualificado",
    CONVERTIDO: "Convertido",
    PERDIDO: "Perdido",
  };
  return map[estado] ?? estado;
}

export function leadEstadoVariant(
  estado: string,
): "default" | "blue" | "green" | "red" | "yellow" {
  const map: Record<string, "default" | "blue" | "green" | "red" | "yellow"> = {
    NOVO: "blue",
    CONTACTADO: "yellow",
    QUALIFICADO: "default",
    CONVERTIDO: "green",
    PERDIDO: "red",
  };
  return map[estado] ?? "default";
}

type CrmUserRef = { displayName: string } | null | undefined;

export function fmtCrmAutor(user?: CrmUserRef): string {
  return user?.displayName?.trim() || "-";
}

/** Proposta: criador; se enviada por outra pessoa, indica também. */
export function fmtPropostaAutoria(criadoPor?: CrmUserRef, enviadaPor?: CrmUserRef): string {
  const criador = criadoPor?.displayName?.trim();
  const enviado = enviadaPor?.displayName?.trim();
  if (criador && enviado && criador !== enviado) {
    return `${criador} · enviada por ${enviado}`;
  }
  return criador || enviado || "-";
}

export function leadOrigemLabel(origem: string) {
  const map: Record<string, string> = {
    WEBSITE: "Website",
    REFERRAL: "Referência",
    FEIRA: "Feira / evento",
    LINKEDIN: "LinkedIn",
    TELEFONE: "Telefone",
    IA: "Sugestão IA",
    OUTRO: "Outro",
  };
  return map[origem] ?? origem;
}

export type FaturaEstado = "RASCUNHO" | "EMITIDA" | "COMUNICADA_AT" | "ANULADA";

export function faturaEstadoLabel(estado: string) {
  const map: Record<string, string> = {
    RASCUNHO: "Rascunho",
    EMITIDA: "Emitida",
    COMUNICADA_AT: "Comunicada AT",
    ANULADA: "Anulada",
  };
  return map[estado] ?? estado;
}

export function faturaEstadoVariant(
  estado: string,
): "default" | "blue" | "green" | "red" | "yellow" {
  const map: Record<string, "default" | "blue" | "green" | "red" | "yellow"> = {
    RASCUNHO: "yellow",
    EMITIDA: "blue",
    COMUNICADA_AT: "green",
    ANULADA: "red",
  };
  return map[estado] ?? "default";
}

export function fmtFaturaRef(serie: { codigo: string; tipo: string }, numero: number | null) {
  if (numero == null) return `${serie.tipo} ${serie.codigo} · rascunho`;
  return `${serie.tipo} ${serie.codigo}/${numero}`;
}

export function credencialStatus(validade: string | null | undefined): "ok" | "aviso" | "critico" | "ausente" {
  if (!validade) return "ausente";
  const dias = Math.ceil((new Date(validade).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "critico";
  if (dias <= 90) return "aviso";
  return "ok";
}
