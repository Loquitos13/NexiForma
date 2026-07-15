import type { TenantUserRole } from "@nexiforma/database";
import type { SigoProtocolo, SigoRegiaoPortal } from "./soap";

/** Acções SIGO / certificação com controlo de acesso por role. */
export type SigoAcaoAcesso =
  | "configurar"
  | "submeter"
  | "reconciliar"
  | "sincronizar"
  | "certificar"
  | "emitirCertificadoLocal"
  | "descarregarSigo"
  | "notificarFormandos";

export type SigoPerfisAcesso = Record<SigoAcaoAcesso, TenantUserRole[]>;

export const SIGO_ACOES_ACESSO: readonly SigoAcaoAcesso[] = [
  "configurar",
  "submeter",
  "reconciliar",
  "sincronizar",
  "certificar",
  "emitirCertificadoLocal",
  "descarregarSigo",
  "notificarFormandos",
] as const;

export const SIGO_PERFIS_PADRAO: SigoPerfisAcesso = {
  configurar: ["ADMIN"],
  submeter: ["ADMIN", "COORDENADOR"],
  reconciliar: ["ADMIN", "COORDENADOR"],
  sincronizar: ["ADMIN", "COORDENADOR"],
  certificar: ["ADMIN", "COORDENADOR"],
  emitirCertificadoLocal: ["ADMIN", "COORDENADOR"],
  descarregarSigo: ["ADMIN", "COORDENADOR", "FORMADOR", "FORMANDO"],
  notificarFormandos: ["ADMIN", "COORDENADOR"],
};

const ROLE_LABELS: Record<TenantUserRole, string> = {
  ADMIN: "Administrador",
  COORDENADOR: "Coordenador",
  FORMADOR: "Formador",
  FORMANDO: "Formando",
  FINANCEIRO: "Financeiro",
  COMERCIAL: "Comercial",
};

export const SIGO_ACAO_LABELS: Record<SigoAcaoAcesso, string> = {
  configurar: "Configurar integração SIGO",
  submeter: "Submeter acção à SIGO",
  reconciliar: "Reconciliar submissões",
  sincronizar: "Sincronizar certificados PDF",
  certificar: "Certificar (fluxo completo)",
  emitirCertificadoLocal: "Emitir certificado local (HTML/PDF)",
  descarregarSigo: "Descarregar certificado oficial SIGO",
  notificarFormandos: "Notificar formandos (certificado disponível)",
};

export function labelSigoRole(role: TenantUserRole): string {
  return ROLE_LABELS[role] ?? role;
}

function isTenantUserRole(value: unknown): value is TenantUserRole {
  return (
    value === "ADMIN" ||
    value === "COORDENADOR" ||
    value === "FORMADOR" ||
    value === "FORMANDO" ||
    value === "FINANCEIRO" ||
    value === "COMERCIAL"
  );
}

/** Normaliza JSON guardado em BD para perfis completos com defaults. */
export function normalizarPerfisAcesso(raw: unknown): SigoPerfisAcesso {
  const base = { ...SIGO_PERFIS_PADRAO };
  if (!raw || typeof raw !== "object") return base;

  const o = raw as Record<string, unknown>;
  for (const acao of SIGO_ACOES_ACESSO) {
    const list = o[acao];
    if (!Array.isArray(list)) continue;
    const roles = list.filter(isTenantUserRole);
    if (roles.length) base[acao] = [...roles];
  }
  return base;
}

export function podeExecutarAcaoSigo(
  role: TenantUserRole | null | undefined,
  perfis: SigoPerfisAcesso,
  acao: SigoAcaoAcesso,
): boolean {
  if (!role) return false;
  const allowed = perfis[acao] ?? SIGO_PERFIS_PADRAO[acao];
  return allowed.includes(role);
}

export type SigoConfigPublica = {
  integracaoAtiva: boolean;
  protocolo: SigoProtocolo;
  nifEntidade: string;
  codigoEntidade: string | null;
  denominacaoEntidade: string | null;
  baseUrlOverride: string | null;
  wsdlUrl: string | null;
  soapEndpoint: string | null;
  soapUsername: string | null;
  soapPasswordConfigured: boolean;
  ipAutorizado: string | null;
  regiaoPortal: SigoRegiaoPortal;
  apiKeyConfigured: boolean;
  perfisAcesso: SigoPerfisAcesso;
  ultimoTesteOkEm: string | null;
  ultimoTesteMsg: string | null;
  prontoProducao: boolean;
  avisos: string[];
};

export function avaliarProntidaoSigoTenant(input: {
  integracaoAtiva: boolean;
  protocolo: SigoProtocolo;
  nifEntidade: string;
  apiKeyConfigured: boolean;
  soapConfigured: boolean;
  baseUrlDisponivel: boolean;
  soapEndpointDisponivel: boolean;
  ipAutorizado?: string | null;
}): { prontoProducao: boolean; avisos: string[] } {
  const avisos: string[] = [];
  if (!input.integracaoAtiva) {
    avisos.push("Integração SIGO inactiva para esta entidade.");
  }
  if (!input.nifEntidade?.trim()) {
    avisos.push("NIF da entidade formadora em falta.");
  }

  if (input.protocolo === "soap") {
    if (!input.soapConfigured) {
      avisos.push("Credenciais SOAP (utilizador/password WS-Security) não configuradas.");
    }
    if (!input.soapEndpointDisponivel) {
      avisos.push("Endpoint SOAP ou URL WSDL não definido.");
    }
    if (!input.ipAutorizado?.trim()) {
      avisos.push(
        "IP público autorizado não registado – a DGEEC exige whitelisting de IP fixo.",
      );
    }
  } else {
    if (!input.apiKeyConfigured) {
      avisos.push("API key SIGO não configurada.");
    }
    if (!input.baseUrlDisponivel) {
      avisos.push("URL base da API SIGO não definida (plataforma ou override tenant).");
    }
  }

  const prontoProducao =
    input.integracaoAtiva &&
    Boolean(input.nifEntidade?.trim()) &&
    (input.protocolo === "soap"
      ? input.soapConfigured && input.soapEndpointDisponivel
      : input.apiKeyConfigured && input.baseUrlDisponivel);

  return { prontoProducao, avisos };
}
