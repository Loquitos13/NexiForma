import type { TenantEntitlements } from "./entitlements";

export type IntegrationPluginId = "salas_online" | "moodle";

export type IntegrationPluginDef = {
  id: IntegrationPluginId;
  title: string;
  description: string;
  providers: readonly ("ZOOM" | "TEAMS" | "MOODLE")[];
};

export const INTEGRATION_PLUGINS: readonly IntegrationPluginDef[] = [
  {
    id: "salas_online",
    title: "Salas online",
    description: "Zoom e Microsoft Teams para sessões síncronas com OAuth.",
    providers: ["ZOOM", "TEAMS"],
  },
  {
    id: "moodle",
    title: "Moodle LMS",
    description: "Sincronização de cursos via Web Services Moodle.",
    providers: ["MOODLE"],
  },
] as const;

export function isIntegrationPluginAllowed(
  pluginId: IntegrationPluginId,
  ent: TenantEntitlements,
): boolean {
  if (pluginId === "moodle") return ent.canAccessCoreFormation;
  return ent.canAccessFormacaoTeams;
}

export function hasAnyIntegrationPlugin(ent: TenantEntitlements): boolean {
  return INTEGRATION_PLUGINS.some((p) => isIntegrationPluginAllowed(p.id, ent));
}

export function isIntegracaoProviderAllowed(
  provider: string,
  ent: TenantEntitlements,
): boolean {
  if (provider === "MOODLE") return ent.canAccessCoreFormation;
  if (provider === "ZOOM" || provider === "TEAMS") return ent.canAccessFormacaoTeams;
  return false;
}
