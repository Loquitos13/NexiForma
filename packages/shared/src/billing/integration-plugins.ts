import type { TenantEntitlements } from "./entitlements";

export type IntegrationPluginId = "salas_online" | "moodle";

export type IntegrationPluginDef = {
  id: IntegrationPluginId;
  title: string;
  description: string;
  tagline: string;
  category: "Salas" | "LMS";
  publisher: string;
  providers: readonly ("ZOOM" | "TEAMS" | "MOODLE")[];
};

export const INTEGRATION_PLUGINS: readonly IntegrationPluginDef[] = [
  {
    id: "salas_online",
    title: "Salas online",
    tagline: "Zoom & Microsoft Teams",
    description: "Cria salas síncronas no cronograma com OAuth. Formadores e formandos entram pelo link da sessão.",
    category: "Salas",
    publisher: "NexiForma",
    providers: ["ZOOM", "TEAMS"],
  },
  {
    id: "moodle",
    title: "Moodle LMS",
    tagline: "Sincronização de cursos",
    description: "Importa cursos e estrutura via Web Services Moodle para o percurso NexiForma.",
    category: "LMS",
    publisher: "NexiForma",
    providers: ["MOODLE"],
  },
] as const;

export function isIntegrationPluginAllowed(
  pluginId: IntegrationPluginId,
  ent: TenantEntitlements,
): boolean {
  if (pluginId === "moodle") return ent.canAccessCoreFormation;
  return ent.canAccessFormacaoTeams || ent.canAccessCrm;
}

export function hasAnyIntegrationPlugin(ent: TenantEntitlements): boolean {
  return INTEGRATION_PLUGINS.some((p) => isIntegrationPluginAllowed(p.id, ent));
}

export function isIntegracaoProviderAllowed(
  provider: string,
  ent: TenantEntitlements,
): boolean {
  if (provider === "MOODLE") return ent.canAccessCoreFormation;
  if (provider === "ZOOM" || provider === "TEAMS") {
    return ent.canAccessFormacaoTeams || ent.canAccessCrm;
  }
  return false;
}
