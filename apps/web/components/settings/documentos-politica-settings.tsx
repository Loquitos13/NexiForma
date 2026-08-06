"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Button } from "@/components/ui";

type Opt = { id: string; label: string; ajuda: string };

type Payload = {
  politica: { universaisObrigatorios: string[] };
  opcoesUniversais: Opt[];
  opcoesInscricao: Opt[];
  ajuda: string;
};

export function DocumentosPoliticaSettings() {
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await bffFetch("/api/v1/portal/tenant/documentos-politica", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const json = (await r.json()) as Payload;
    setData(json);
    setSelected(json.politica.universaisObrigatorios);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/portal/tenant/documentos-politica", {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ universaisObrigatorios: selected }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("Não foi possível guardar a política documental.");
      return;
    }
    setMsg("Documentos universais obrigatórios actualizados.");
    await load();
  }

  if (!data) return null;

  return (
    <section className="rounded-2xl bg-slate-900/50 border border-slate-700/30 p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Documentos do formando</h2>
        <p className="text-sm text-slate-400 mt-1">{data.ajuda}</p>
      </div>

      {error ? (
        <p className="text-xs text-red-300 rounded-lg border border-red-500/25 bg-red-950/20 px-3 py-2">{error}</p>
      ) : null}
      {msg ? (
        <p className="text-xs text-green-300 rounded-lg border border-green-500/25 bg-green-950/20 px-3 py-2">{msg}</p>
      ) : null}

      <form onSubmit={(e) => void save(e)} className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-200 mb-2">Universais (ficha do formando)</h3>
          <p className="text-xs text-slate-500 mb-3">
            Escolhe quais ficam obrigatórios em todas as inscrições. O formando carrega uma vez e reutiliza.
          </p>
          <ul className="space-y-2">
            {data.opcoesUniversais.map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-3 rounded-lg border border-slate-700/40 bg-slate-950/40 px-3 py-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                />
                <span>
                  <span className="text-sm text-slate-200 block">{opt.label}</span>
                  <span className="text-[11px] text-slate-500 block">{opt.ajuda}</span>
                </span>
              </label>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium text-slate-200 mb-2">Por inscrição / edição</h3>
          <p className="text-xs text-slate-500 mb-2">
            Contrato, declaração e regulamento moldam-se por curso/acção (horas, valor, datas). Configura na ficha
            da acção (tab Documentos: Ver / Editar / Upload PDF).
          </p>
          <ul className="space-y-1.5 text-xs text-slate-400">
            {data.opcoesInscricao.map((opt) => (
              <li key={opt.id}>
                <span className="text-slate-300">{opt.label}</span> - {opt.ajuda}
              </li>
            ))}
          </ul>
        </div>

        <Button type="submit" disabled={busy}>
          {busy ? "A guardar…" : "Guardar política"}
        </Button>
      </form>
    </section>
  );
}
