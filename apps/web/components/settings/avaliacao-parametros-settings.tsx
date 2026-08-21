"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Button, Input } from "@/components/ui";

type TipoOpt = { id: string; label: string };

type Parametros = {
  notaMinimaAprovacao: number;
  escalaMaxima: number;
  tiposPermitidos: string[];
  exigirObservacoesAbaixoMinima: boolean;
};

type Payload = {
  parametros: Parametros;
  opcoesTipos: TipoOpt[];
  ajuda: string;
};

type Props = {
  compact?: boolean;
  onSaved?: (params: Parametros) => void;
};

export function AvaliacaoParametrosSettings({ compact = false, onSaved }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [form, setForm] = useState<Parametros | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await bffFetch("/api/v1/portal/tenant/avaliacao-parametros", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const json = (await r.json()) as Payload;
    setData(json);
    setForm(json.parametros);
    onSaved?.(json.parametros);
  }, [onSaved]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    if (!data || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(data.parametros);
  }, [data, form]);

  function toggleTipo(id: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.tiposPermitidos.includes(id);
      const tiposPermitidos = has
        ? prev.tiposPermitidos.filter((x) => x !== id)
        : [...prev.tiposPermitidos, id];
      return { ...prev, tiposPermitidos };
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (form.tiposPermitidos.length === 0) {
      setError("Selecciona pelo menos um tipo de avaliação.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/portal/tenant/avaliacao-parametros", {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Não foi possível guardar os parâmetros de avaliação.");
      return;
    }
    const json = (await r.json()) as { parametros: Parametros };
    setForm(json.parametros);
    setData((prev) => (prev ? { ...prev, parametros: json.parametros } : prev));
    setMsg("Parâmetros de avaliação actualizados.");
    onSaved?.(json.parametros);
    await load();
  }

  if (!data || !form) return null;

  return (
    <section
      className={
        compact
          ? "space-y-4"
          : "rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4"
      }
    >
      {!compact ? (
        <div>
          <h2 className="text-base font-semibold text-slate-100">Parâmetros de avaliação</h2>
          <p className="text-sm text-slate-400 mt-1">{data.ajuda}</p>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-red-300 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-xs text-green-300 rounded-lg border border-green-500/25 bg-green-950/20 px-3 py-2">
          {msg}
        </p>
      ) : null}

      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
          <Input
            label="Escala máxima"
            type="number"
            min={1}
            max={100}
            value={form.escalaMaxima}
            onChange={(e) =>
              setForm((f) =>
                f ? { ...f, escalaMaxima: Math.min(100, Math.max(1, Number(e.target.value) || 100)) } : f,
              )
            }
          />
          <Input
            label="Nota mínima para aprovação"
            type="number"
            min={0}
            max={form.escalaMaxima}
            value={form.notaMinimaAprovacao}
            onChange={(e) =>
              setForm((f) =>
                f
                  ? {
                      ...f,
                      notaMinimaAprovacao: Math.min(
                        f.escalaMaxima,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    }
                  : f,
              )
            }
          />
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-200 mb-2">Tipos permitidos</h3>
          <ul className="flex flex-wrap gap-2">
            {data.opcoesTipos.map((opt) => {
              const active = form.tiposPermitidos.includes(opt.id);
              return (
                <label
                  key={opt.id}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                    active
                      ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                      : "border-slate-700/50 bg-slate-950/40 text-slate-400"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={active}
                    onChange={() => toggleTipo(opt.id)}
                  />
                  {opt.label}
                </label>
              );
            })}
          </ul>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.exigirObservacoesAbaixoMinima}
            onChange={(e) =>
              setForm((f) =>
                f ? { ...f, exigirObservacoesAbaixoMinima: e.target.checked } : f,
              )
            }
          />
          <span>
            Exigir observações quando a nota ficar abaixo do mínimo de aprovação
          </span>
        </label>

        {dirty ? (
          <Button type="submit" disabled={busy}>
            {busy ? "A guardar…" : "Guardar parâmetros"}
          </Button>
        ) : null}
      </form>
    </section>
  );
}

export type { Parametros as AvaliacaoParametros };
