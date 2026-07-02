"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { useTenantRole } from "@/lib/client/use-tenant-role";

type TenantInfo = {
  slug: string;
  legalName: string;
  nif: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

type CronogramaConfig = {
  local?: string;
  horarioInicio?: string;
  horarioFim?: string;
  horarioSabadoInicio?: string;
  horarioSabadoFim?: string;
  funcionamento?: "laboral" | "pos_laboral" | "misto";
  metodologias?: string[];
};

type Branding = {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
  supportEmail?: string;
  supportPhone?: string;
  footerText?: string;
  cronograma?: CronogramaConfig;
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
  const logoRef = useRef<HTMLInputElement>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [cnaefAreas, setCnaefAreas] = useState<string[]>([
    "481 - Ciencias Informaticas",
    "482 - Informatica na Optica do Utilizador",
  ]);
  const [feriados, setFeriados] = useState<string[]>([
    "2026-01-01",
    "2026-04-25",
    "2026-05-01",
    "2026-06-10",
    "2026-08-15",
    "2026-12-25",
  ]);
  const [novaArea, setNovaArea] = useState("");
  const [novoFeriado, setNovoFeriado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [tRes, bRes, pRes] = await Promise.all([
      bffFetch("/api/v1/portal/tenant-info", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/portal/tenant/branding", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/billing/subscription", { headers: { accept: "application/json" } }),
    ]);
    if (tRes.ok) setTenant((await tRes.json()) as TenantInfo);
    if (bRes.ok) setBranding((await bRes.json()) as Branding);
    if (pRes.ok) setPlan((await pRes.json()) as PlanInfo);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBranding() {
    if (!canManage || !branding) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/portal/tenant/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(branding),
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
    setMsg("Logo da entidade actualizado.");
    await load();
  }

  function toggleMetodologia(key: string) {
    setBranding((p) => {
      if (!p) return p;
      const current = p.cronograma?.metodologias ?? [];
      const next = current.includes(key) ? current.filter((x) => x !== key) : [...current, key];
      return {
        ...p,
        cronograma: { ...(p.cronograma ?? {}), metodologias: next },
      };
    });
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

  const logoPreview = branding?.logoUrl
    ? branding.logoUrl.startsWith("/")
      ? branding.logoUrl
      : branding.logoUrl
    : null;

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Configurações</h1>
        <p className="text-sm text-slate-500 mt-1">
          Branding da entidade, logo no cronograma DGERT, horários e preferências.
        </p>
      </div>

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

      {tenant ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Entidade formadora</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Nome:</span>{" "}
              <span className="text-slate-200">{tenant.legalName}</span>
            </div>
            <div>
              <span className="text-slate-500">NIF:</span>{" "}
              <span className="text-slate-200">{tenant.nif}</span>
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
          {plan ? (
            <div className="mt-3 pt-3 border-t border-slate-700/30 text-xs text-slate-500">
              Plano: {plan.plan.name} ({plan.status})
              {plan.currentPeriodEnd
                ? ` · até ${formatDatePt(plan.currentPeriodEnd)}`
                : ""}
            </div>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200">Branding e logo (cronograma)</h2>
          <p className="text-xs text-slate-500">
            O logo aparece no canto superior esquerdo do cronograma DGERT impresso.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo da entidade"
                className="h-14 max-w-[180px] object-contain rounded-lg bg-white/95 px-2 py-1"
              />
            ) : (
              <div className="h-14 w-32 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-xs text-slate-500">
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

          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">
            Dados do cronograma DGERT
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Local da formação</label>
              <input
                value={branding?.cronograma?.local ?? ""}
                onChange={(e) =>
                  setBranding((p) =>
                    p ? { ...p, cronograma: { ...(p.cronograma ?? {}), local: e.target.value } } : null,
                  )
                }
                className={inputClass}
                placeholder="Ex: Lisboa"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Funcionamento</label>
              <select
                value={branding?.cronograma?.funcionamento ?? "pos_laboral"}
                onChange={(e) =>
                  setBranding((p) =>
                    p
                      ? {
                          ...p,
                          cronograma: {
                            ...(p.cronograma ?? {}),
                            funcionamento: e.target.value as CronogramaConfig["funcionamento"],
                          },
                        }
                      : null,
                  )
                }
                className={inputClass}
              >
                <option value="laboral">Laboral</option>
                <option value="pos_laboral">Pós-Laboral</option>
                <option value="misto">Misto</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Horário início (dias úteis)</label>
              <input
                value={branding?.cronograma?.horarioInicio ?? ""}
                onChange={(e) =>
                  setBranding((p) =>
                    p
                      ? { ...p, cronograma: { ...(p.cronograma ?? {}), horarioInicio: e.target.value } }
                      : null,
                  )
                }
                className={inputClass}
                placeholder="18:30"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Horário fim (dias úteis)</label>
              <input
                value={branding?.cronograma?.horarioFim ?? ""}
                onChange={(e) =>
                  setBranding((p) =>
                    p ? { ...p, cronograma: { ...(p.cronograma ?? {}), horarioFim: e.target.value } } : null,
                  )
                }
                className={inputClass}
                placeholder="22:00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sábados - início</label>
              <input
                value={branding?.cronograma?.horarioSabadoInicio ?? ""}
                onChange={(e) =>
                  setBranding((p) =>
                    p
                      ? {
                          ...p,
                          cronograma: { ...(p.cronograma ?? {}), horarioSabadoInicio: e.target.value },
                        }
                      : null,
                  )
                }
                className={inputClass}
                placeholder="09:00"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sábados - fim</label>
              <input
                value={branding?.cronograma?.horarioSabadoFim ?? ""}
                onChange={(e) =>
                  setBranding((p) =>
                    p
                      ? { ...p, cronograma: { ...(p.cronograma ?? {}), horarioSabadoFim: e.target.value } }
                      : null,
                  )
                }
                className={inputClass}
                placeholder="13:30"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={branding?.cronograma?.metodologias?.includes("elearning") ?? false}
                onChange={() => toggleMetodologia("elearning")}
              />
              Formação à distância
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={branding?.cronograma?.metodologias?.includes("formacao_acao") ?? true}
                onChange={() => toggleMetodologia("formacao_acao")}
              />
              Formação-Acção
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={branding?.cronograma?.metodologias?.includes("outras") ?? false}
                onChange={() => toggleMetodologia("outras")}
              />
              Outras
            </label>
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
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Áreas de formação (CNAEF)</h2>
          <p className="text-xs text-slate-500 mb-3">
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

      {canManage ? (
        <div className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Pausas e feriados</h2>
          <p className="text-xs text-slate-500 mb-3">
            Registo de pausas letivas e feriados a considerar nos cronogramas de formação.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {feriados.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/40 border border-slate-700/20 text-xs text-slate-300"
              >
                {formatDatePt(f)}
                <button
                  onClick={() => {
                    setFeriados(feriados.filter((_, j) => j !== i));
                    setMsg("Feriado removido.");
                  }}
                  className="text-red-400 hover:text-red-300 ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-xs">
            <input
              type="date"
              value={novoFeriado}
              onChange={(e) => setNovoFeriado(e.target.value)}
              className={inputClass}
            />
            <button
              onClick={() => addItem(feriados, setFeriados, novoFeriado, setNovoFeriado)}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              +
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
