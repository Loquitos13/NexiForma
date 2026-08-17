"use client";

import type { TenantEntitlements } from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";

export type ConfigModuloId = "geral" | "formacao" | "crm" | "faturacao";

export type ConfigModulo = {
  id: ConfigModuloId;
  label: string;
  description: string;
};

export function resolveConfigModulos(entitlements: TenantEntitlements | null): ConfigModulo[] {
  const mods: ConfigModulo[] = [
    {
      id: "geral",
      label: "Geral",
      description: "Entidade, branding e logótipos em documentos",
    },
  ];
  if (entitlements?.canAccessCoreFormation) {
    mods.push({
      id: "formacao",
      label: "Formação",
      description: "Templates pedagógicos e documentos de inscrição",
    });
  }
  if (entitlements?.canAccessCrm) {
    mods.push({
      id: "crm",
      label: "CRM",
      description: "Templates de propostas e contratos",
    });
  }
  if (entitlements?.canAccessFaturacao) {
    mods.push({
      id: "faturacao",
      label: "Faturação",
      description: "Séries, cabeçalhos e rodapés fiscais",
    });
  }
  return mods;
}

export function ConfiguracoesModuloNav({
  modulos,
  active,
  onChange,
}: {
  modulos: ConfigModulo[];
  active: ConfigModuloId;
  onChange: (id: ConfigModuloId) => void;
}) {
  return (
    <nav
      aria-label="Módulos de configuração"
      className="flex flex-col gap-1 rounded-xl border border-slate-700/40 bg-slate-900/40 p-2"
    >
      {modulos.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onChange(m.id)}
          className={cn(
            "rounded-lg px-3 py-2 text-left transition-colors",
            active === m.id
              ? "bg-blue-600/20 text-blue-200 ring-1 ring-blue-500/30"
              : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200",
          )}
        >
          <span className="block text-sm font-medium">{m.label}</span>
          <span className="block text-[11px] opacity-80">{m.description}</span>
        </button>
      ))}
    </nav>
  );
}
