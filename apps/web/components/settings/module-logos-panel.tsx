"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import type { ModuleLogoAsset, TemplateModulo } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Button } from "@/components/ui";

type Props = {
  modulo: TemplateModulo;
  title?: string;
};

export function ModuleLogosPanel({ modulo, title }: Props) {
  const [logos, setLogos] = useState<ModuleLogoAsset[]>([]);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await bffFetch(
      `/api/v1/portal/tenant/module-logos?modulo=${encodeURIComponent(modulo)}`,
      { headers: { accept: "application/json" } },
    );
    if (!r.ok) return;
    const data = (await r.json()) as { logos?: ModuleLogoAsset[] };
    setLogos(data.logos ?? []);
  }, [modulo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    if (nome.trim()) fd.append("nome", nome.trim());
    const r = await bffFetch(
      `/api/v1/portal/tenant/module-logos?modulo=${encodeURIComponent(modulo)}`,
      { method: "POST", body: fd },
    );
    setBusy(false);
    if (!r.ok) {
      setErr("Não foi possível importar o logótipo.");
      return;
    }
    setNome("");
    setMsg("Logótipo importado.");
    await load();
  }

  async function remove(logoId: string) {
    if (!window.confirm("Eliminar este logótipo?")) return;
    setBusy(true);
    const r = await bffFetch(
      `/api/v1/portal/tenant/module-logos/${encodeURIComponent(logoId)}?modulo=${encodeURIComponent(modulo)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!r.ok) {
      setErr("Não foi possível eliminar.");
      return;
    }
    await load();
  }

  function logoUrl(logoId: string) {
    return `/api/v1/portal/tenant/module-logos/${encodeURIComponent(logoId)}/file?modulo=${encodeURIComponent(modulo)}`;
  }

  return (
    <section className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">
          {title ?? "Logótipos do módulo"}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Importe logótipos da entidade formadora, DGERT ou parceiros. Use-os nos templates e na
          emissão de documentos (cabeçalho, rodapé ou marca d&apos;água).
        </p>
      </div>

      {err ? <p className="text-xs text-red-300">{err}</p> : null}
      {msg ? <p className="text-xs text-green-300">{msg}</p> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block space-y-1 min-w-[12rem]">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
            Nome (opcional)
          </span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Logo DGERT"
            className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Importar logótipo
        </Button>
      </div>

      {logos.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {logos.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-lg border border-slate-700/40 bg-slate-950/60 p-3"
            >
              <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded bg-white p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl(l.id)} alt={l.nome} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-200">{l.nome}</p>
                <p className="truncate text-[10px] text-slate-500">{l.id}</p>
              </div>
              <button
                type="button"
                title="Eliminar"
                disabled={busy}
                className="rounded p-1 text-slate-500 hover:bg-red-950/40 hover:text-red-300"
                onClick={() => void remove(l.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <ImagePlus className="h-4 w-4" />
          Ainda sem logótipos importados para este módulo.
        </p>
      )}
    </section>
  );
}
