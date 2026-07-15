export const PORTAL_FROM_PARAM = "from";

const BACK_LABELS: Record<string, string> = {
  "/portal/clientes": "Clientes",
  "/portal/crm": "CRM",
  "/portal/crm/leads": "Leads",
  "/portal/crm/leads/clientes": "Leads · Clientes",
  "/portal/crm/interaccoes": "Notas comerciais",
  "/portal/crm/interaccoes/clientes": "Notas comerciais · Clientes",
  "/portal/crm/sugestoes-ia": "Sugestões IA",
  "/portal/crm/sugestoes-ia/clientes": "Sugestões IA · Clientes",
  "/portal/propostas": "Propostas",
  "/portal/propostas/clientes": "Propostas · Clientes",
  "/portal/crm/faturas": "Faturas",
  "/portal/contratos": "Contratos",
};

/** Caminho interno do portal válido para navegação «voltar». */
export function isValidPortalFrom(path: string | null | undefined): path is string {
  if (!path) return false;
  const pathOnly = path.split("?")[0] ?? path;
  if (!pathOnly.startsWith("/portal/")) return false;
  if (pathOnly.includes("..") || pathOnly.includes("//")) return false;
  return true;
}

export function labelForPortalFrom(path: string): string {
  const pathOnly = path.split("?")[0] ?? path;
  if (BACK_LABELS[pathOnly]) return BACK_LABELS[pathOnly];
  if (pathOnly.endsWith("/clientes")) {
    const parent = pathOnly.replace(/\/clientes$/, "");
    const parentLabel = BACK_LABELS[parent];
    if (parentLabel) return `${parentLabel} · Clientes`;
    return "Clientes";
  }
  const last = pathOnly.split("/").filter(Boolean).at(-1);
  if (last === "leads") return "Leads";
  if (last === "interaccoes") return "Notas comerciais";
  if (last === "sugestoes-ia") return "Sugestões IA";
  if (last === "propostas") return "Propostas";
  if (last === "faturas") return "Faturas";
  return "Voltar";
}

/** Anexa origem à URL de destino (lista → detalhe). */
export function withPortalFrom(targetHref: string, fromPath: string): string {
  if (!isValidPortalFrom(fromPath)) return targetHref;
  const qIndex = targetHref.indexOf("?");
  const pathname = qIndex >= 0 ? targetHref.slice(0, qIndex) : targetHref;
  const params = new URLSearchParams(qIndex >= 0 ? targetHref.slice(qIndex + 1) : "");
  params.set(PORTAL_FROM_PARAM, fromPath.split("?")[0] ?? fromPath);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export const portalBackButtonClassName =
  "mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50";
