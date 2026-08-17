"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { DgertRequisitoBanner, DgertTarget } from "@/components/portal/dgert-requisito-banner";
import { publicTenantLogoUrl } from "@/lib/client/tenant-logo-url";
import {
  ConfiguracoesModuloNav,
  resolveConfigModulos,
  type ConfigModuloId,
} from "@/components/settings/configuracoes-modulo-nav";
import { ConfiguracoesFormacaoPanel } from "@/components/settings/configuracoes-formacao-panel";
import { ConfiguracoesCrmPanel } from "@/components/settings/configuracoes-crm-panel";
import { TemplateEditorPanel } from "@/components/settings/template-editor-panel";

type TenantInfo = {
  slug: string;
  legalName: string;
  nif: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

type Branding = {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  supportEmail?: string;
  supportPhone?: string;
  footerText?: string;
  logoCabecalho?: { posicao?: string; larguraPx?: number; alturaPx?: number };
  logoRodape?: { posicao?: string; larguraPx?: number; alturaPx?: number };
};

type PlanInfo = {
  plan: { name: string; code: string };
  status: string;
  currentPeriodEnd: string | null;
};

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/60 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-blue-500/40";

export default function ConfiguracoesPage() {
  const { canManage } = useTenantRole();
  const { entitlements } = useTenantEntitlements();
  const modulos = useMemo(() => resolveConfigModulos(entitlements), [entitlements]);
  const [modulo, setModulo] = useState<ConfigModuloId>("geral");
  const logoRef = useRef<HTMLInputElement>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [cnaefAreas, setCnaefAreas] = useState<string[]>([
    "481 - Ciencias Informaticas",
    "482 - Informatica na Optica do Utilizador",
  ]);
  const [novaArea, setNovaArea] = useState("");
  const [logoBust, setLogoBust] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entidadeForm, setEntidadeForm] = useState({ legalName: "", nif: "" });

  const load = useCallback(async () => {
    const [tRes, bRes, pRes] = await Promise.all([
      bffFetch("/api/v1/portal/tenant-info", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/portal/tenant/branding", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/billing/subscription", { headers: { accept: "application/json" } }),
    ]);
    if (tRes.ok) {
      const t = (await tRes.json()) as TenantInfo;
      setTenant(t);
      setEntidadeForm({ legalName: t.legalName ?? "", nif: t.nif ?? "" });
    }
    if (bRes.ok) setBranding((await bRes.json()) as Branding);
    if (pRes.ok) setPlan((await pRes.json()) as PlanInfo);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modulos.some((m) => m.id === modulo)) {
      setModulo(modulos[0]?.id ?? "geral");
    }
  }, [modulos, modulo]);

  async function saveEntidade() {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/portal/tenant/entidade", {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        legalName: entidadeForm.legalName.trim(),
        nif: entidadeForm.nif.replace(/\s/g, "").trim(),
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = (await r.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(d?.message)
        ? d.message.join(", ")
        : typeof d?.message === "string"
          ? d.message
          : `Erro ao guardar entidade (HTTP ${r.status}).`;
      setError(message);
      return;
    }
    setMsg("Dados da entidade actualizados.");
    await load();
  }

  async function saveBranding() {
    if (!canManage || !branding) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const { logoUrl: _logo, ...payload } = branding;
    const r = await bffFetch("/api/v1/portal/tenant/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao guardar configuração.");
      return;
    }
    setMsg("Configuração guardada.");
    await load();
  }

  async function uploadLogo(file: File) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await bffFetch("/api/v1/portal/tenant/logo", {
      method: "POST",
      body: fd,
    });
    setBusy(false);
    if (!r.ok) {
      setError("Erro ao carregar logo.");
      return;
    }
    const data = (await r.json()) as { logoUrl?: string };
    setBranding((p) => (p ? { ...p, logoUrl: data.logoUrl ?? p.logoUrl } : p));
    setLogoBust(Date.now());
    setMsg("Logo da entidade actualizado.");
    await load();
  }

  function addItem(
    list: string[],
    setList: (v: string[]) => void,
    value: string,
    setValue: (v: string) => void,
  ) {
    if (!value.trim()) return;
    if (list.includes(value.trim())) return;
    setList([...list, value.trim()]);
    setValue("");
    setMsg("Item adicionado (guardado localmente).");
  }

  const logoPreview = (() => {
    if (!branding?.logoUrl) return null;
    if (/^https?:\/\//i.test(branding.logoUrl)) return branding.logoUrl;
    if (tenant?.slug) return publicTenantLogoUrl(tenant.slug, logoBust || undefined);
    return branding.logoUrl;
  })();

  return (
    <div className="max-w-5xl space-y-6">
      <header className="ui-settings-hero space-y-2 border-b border-slate-700/30 pb-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Administração
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Configurações</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
          Opções da entidade organizadas por módulo contratado no plano.
        </p>
      </header>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      ) : null}
      {msg ? (
        <div className="flex items-start gap-2.5 rounded-xl bg-green-950/30 border border-green-500/25 px-4 py-3">
          <p className="text-sm text-green-300">{msg}</p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {canManage && modulos.length > 1 ? (
          <ConfiguracoesModuloNav modulos={modulos} active={modulo} onChange={setModulo} />
        ) : null}

        <div className="min-w-0 space-y-6">
          {modulo === "formacao" ? <ConfiguracoesFormacaoPanel /> : null}
          {modulo === "crm" ? <ConfiguracoesCrmPanel /> : null}
          {modulo === "faturacao" ? (
            <TemplateEditorPanel
              modulo="faturacao"
              title="Templates de faturação"
              description="Recibos, notas de crédito e documentos fiscais com variáveis do cliente e da fatura."
            />
          ) : null}
          {modulo === "geral" ? (
            <>
      <DgertRequisitoBanner backHref="/portal/dossie" />

      {tenant ? (
        <DgertTarget id="entidade" className="ui-settings-card scroll-mt-24 rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="ui-settings-card-title text-sm font-semibold mb-1">Entidade formadora</h2>
          <p className="ui-settings-card-desc text-xs mb-4">
            Nome legal e NIF usados em DGERT, dossiê e faturação. Alterações ficam na base de dados
            partilhada com o painel do superadmin.
          </p>
          {canManage ? (
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Nome legal</span>
                <input
                  className={`${inputClass} mt-1`}
                  value={entidadeForm.legalName}
                  onChange={(e) =>
                    setEntidadeForm((f) => ({ ...f, legalName: e.target.value }))
                  }
                  maxLength={200}
                  required
                />
              </label>
              <label className="block text-sm" data-dgert-target="entidade_nif">
                <span className="text-slate-500 text-xs">NIF</span>
                <input
                  className={`${inputClass} mt-1 font-mono tracking-wide`}
                  value={entidadeForm.nif}
                  onChange={(e) =>
                    setEntidadeForm((f) => ({
                      ...f,
                      nif: e.target.value.replace(/[^\d]/g, "").slice(0, 9),
                    }))
                  }
                  inputMode="numeric"
                  pattern="\d{9}"
                  maxLength={9}
                  placeholder="9 dígitos"
                  required
                />
              </label>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveEntidade()}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold text-white"
                >
                  {busy ? "A guardar…" : "Guardar entidade"}
                </button>
                <span className="text-xs text-slate-600">
                  Slug <code className="text-purple-300">{tenant.slug}</code>
                  {" · "}
                  {tenant.status}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <span className="text-slate-500">Nome:</span>{" "}
                <span className="text-slate-200">{tenant.legalName}</span>
              </div>
              <div>
                <span className="text-slate-500">NIF:</span>{" "}
                <span className="text-slate-200 font-semibold">{tenant.nif || "- em falta -"}</span>
              </div>
              <div>
                <span className="text-slate-500">Slug:</span>{" "}
                <code className="text-purple-300">{tenant.slug}</code>
              </div>
              <div>
                <span className="text-slate-500">Estado:</span>{" "}
                <span className="text-slate-200">{tenant.status}</span>
              </div>
            </div>
          )}
          {plan ? (
            <div className="pt-3 border-t border-slate-700/30 text-xs text-slate-500">
              Plano: {plan.plan.name} ({plan.status})
              {plan.currentPeriodEnd
                ? ` · até ${formatDatePt(plan.currentPeriodEnd)}`
                : ""}
            </div>
          ) : null}
        </DgertTarget>
      ) : null}

      {canManage ? (
        <div id="branding" className="ui-settings-card scroll-mt-24 rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4">
          <h2 className="ui-settings-card-title text-sm font-semibold">Branding e logótipo</h2>
          <p className="ui-settings-card-desc text-xs">
            O logótipo desta entidade aparece em faturas, propostas, cronogramas, folhas de presença,
            sumários, certificados e restantes documentos gerados pela aplicação.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreview}
                alt=""
                className="h-14 max-w-[180px] object-contain rounded-lg bg-white px-2 py-1 border border-slate-600/40"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="h-14 w-32 rounded-lg border border-dashed border-slate-600 bg-slate-950/60 flex items-center justify-center text-xs text-slate-400">
                Sem logo
              </div>
            )}
            <div>
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => logoRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200"
              >
                Carregar logo
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Cor primária</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding?.primaryColor ?? "#2563eb"}
                  onChange={(e) =>
                    setBranding((p) => (p ? { ...p, primaryColor: e.target.value } : null))
                  }
                  className="w-10 h-10 rounded-lg border-0 cursor-pointer"
                />
                <input
                  value={branding?.primaryColor ?? ""}
                  onChange={(e) =>
                    setBranding((p) => (p ? { ...p, primaryColor: e.target.value } : null))
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email suporte</label>
              <input
                type="email"
                value={branding?.supportEmail ?? ""}
                onChange={(e) =>
                  setBranding((p) => (p ? { ...p, supportEmail: e.target.value } : null))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700/30">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Logótipo no cabeçalho</p>
              <select
                className={inputClass}
                value={branding?.logoCabecalho?.posicao ?? "left"}
                onChange={(e) =>
                  setBranding((p) =>
                    p
                      ? {
                          ...p,
                          logoCabecalho: { ...(p.logoCabecalho ?? {}), posicao: e.target.value },
                        }
                      : p,
                  )
                }
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={24}
                  max={400}
                  placeholder="Largura px"
                  className={inputClass}
                  value={branding?.logoCabecalho?.larguraPx ?? ""}
                  onChange={(e) =>
                    setBranding((p) =>
                      p
                        ? {
                            ...p,
                            logoCabecalho: {
                              ...(p.logoCabecalho ?? {}),
                              larguraPx: Number(e.target.value) || undefined,
                            },
                          }
                        : p,
                    )
                  }
                />
                <input
                  type="number"
                  min={16}
                  max={200}
                  placeholder="Altura px"
                  className={inputClass}
                  value={branding?.logoCabecalho?.alturaPx ?? ""}
                  onChange={(e) =>
                    setBranding((p) =>
                      p
                        ? {
                            ...p,
                            logoCabecalho: {
                              ...(p.logoCabecalho ?? {}),
                              alturaPx: Number(e.target.value) || undefined,
                            },
                          }
                        : p,
                    )
                  }
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">Logótipo no rodapé</p>
              <select
                className={inputClass}
                value={branding?.logoRodape?.posicao ?? "center"}
                onChange={(e) =>
                  setBranding((p) =>
                    p
                      ? {
                          ...p,
                          logoRodape: { ...(p.logoRodape ?? {}), posicao: e.target.value },
                        }
                      : p,
                  )
                }
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={24}
                  max={400}
                  placeholder="Largura px"
                  className={inputClass}
                  value={branding?.logoRodape?.larguraPx ?? ""}
                  onChange={(e) =>
                    setBranding((p) =>
                      p
                        ? {
                            ...p,
                            logoRodape: {
                              ...(p.logoRodape ?? {}),
                              larguraPx: Number(e.target.value) || undefined,
                            },
                          }
                        : p,
                    )
                  }
                />
                <input
                  type="number"
                  min={16}
                  max={200}
                  placeholder="Altura px"
                  className={inputClass}
                  value={branding?.logoRodape?.alturaPx ?? ""}
                  onChange={(e) =>
                    setBranding((p) =>
                      p
                        ? {
                            ...p,
                            logoRodape: {
                              ...(p.logoRodape ?? {}),
                              alturaPx: Number(e.target.value) || undefined,
                            },
                          }
                        : p,
                    )
                  }
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => void saveBranding()}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            Guardar configuração
          </button>
        </div>
      ) : null}

      {canManage ? (
        <div id="cnaef" className="ui-settings-card scroll-mt-24 rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="ui-settings-card-title text-sm font-semibold mb-3">Áreas de formação (CNAEF)</h2>
          <p className="ui-settings-card-desc text-xs mb-3">
            Áreas de educação e formação da tabela oficial CNAEF em que a entidade está certificada.
          </p>
          <div className="space-y-1.5 mb-3">
            {cnaefAreas.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm text-slate-300 px-3 py-1.5 rounded-lg bg-slate-800/30"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {a}
                <button
                  onClick={() => {
                    setCnaefAreas(cnaefAreas.filter((_, j) => j !== i));
                    setMsg("Área removida.");
                  }}
                  className="ml-auto text-red-400 hover:text-red-300 text-xs"
                >
                  remover
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 max-w-md">
            <input
              value={novaArea}
              onChange={(e) => setNovaArea(e.target.value)}
              placeholder="Ex: 481 - Ciencias Informaticas"
              className={inputClass}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem(cnaefAreas, setCnaefAreas, novaArea, setNovaArea);
                }
              }}
            />
            <button
              onClick={() => addItem(cnaefAreas, setCnaefAreas, novaArea, setNovaArea)}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              +
            </button>
          </div>
        </div>
      ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
