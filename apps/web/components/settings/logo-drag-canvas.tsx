"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  defaultLogoOpacity,
  defaultLogoPlacementCoords,
  normalizeLogoPlacement,
  a4AspectRatio,
  buildDocumentPreviewHtml,
  type DocumentLogoPlacement,
  type DocumentLogoZona,
  type DocumentOrientacao,
  type DocumentVerticalAlign,
  type ModuleLogoAsset,
} from "@nexiforma/shared";
import { Button } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

const ZONAS: { value: DocumentLogoZona; label: string }[] = [
  { value: "cabecalho", label: "Cabeçalho" },
  { value: "rodape", label: "Rodapé" },
  { value: "marca_agua", label: "Marca d'água" },
  { value: "corpo", label: "Corpo" },
];

type Props = {
  logos: ModuleLogoAsset[];
  placements: DocumentLogoPlacement[];
  onChange: (next: DocumentLogoPlacement[]) => void;
  modulo: string;
  /** HTML parcial (legado) */
  previewHtml?: string;
  /** HTML completo para iframe (preferido  evita rebuild duplicado). */
  previewSrcDoc?: string;
  orientacao?: DocumentOrientacao;
  verticalAlign?: DocumentVerticalAlign;
};

type DragState = {
  idx: number;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origW: number;
};

export function LogoDragCanvas({
  logos,
  placements,
  onChange,
  modulo,
  previewHtml,
  previewSrcDoc,
  orientacao = "portrait",
  verticalAlign = "top",
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const normalized = useMemo(
    () => placements.map((p, i) => normalizeLogoPlacement(p, i)),
    [placements],
  );

  const normalizedOnce = useRef(false);
  useEffect(() => {
    if (normalizedOnce.current || !placements.length) return;
    const missing = placements.some(
      (p) => typeof p.xPct !== "number" || typeof p.yPct !== "number",
    );
    if (missing) {
      normalizedOnce.current = true;
      onChange(placements.map((p, i) => normalizeLogoPlacement(p, i)));
    }
  }, [placements, onChange]);

  function logoUrl(logoId: string) {
    return `/api/v1/portal/tenant/module-logos/${encodeURIComponent(logoId)}/file?modulo=${encodeURIComponent(modulo)}`;
  }

  function update(idx: number, patch: Partial<DocumentLogoPlacement>) {
    onChange(placements.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function addLogo(logoId: string) {
    const zona: DocumentLogoZona = "cabecalho";
    const coords = defaultLogoPlacementCoords(zona, placements.length);
    onChange([
      ...placements,
      {
        logoId,
        zona,
        ...coords,
        larguraPx: 140,
        alturaPx: 48,
        opacidade: 1,
        ordem: placements.length,
      },
    ]);
    setSelected(placements.length);
  }

  function remove(idx: number) {
    onChange(placements.filter((_, i) => i !== idx));
    setSelected(null);
  }

  const pctFromEvent = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect?.height) return { xPct: 0, yPct: 0 };
    return {
      xPct: Math.min(98, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      yPct: Math.min(98, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  useEffect(() => {
    if (!drag) return;
    const activeDrag = drag;
    function onMove(e: PointerEvent) {
      const p = normalized[activeDrag.idx];
      if (!p) return;
      if (activeDrag.mode === "move") {
        const { xPct, yPct } = pctFromEvent(e.clientX, e.clientY);
        update(activeDrag.idx, { xPct, yPct });
      } else {
        const dx = e.clientX - activeDrag.startX;
        const dy = e.clientY - activeDrag.startY;
        update(activeDrag.idx, {
          larguraPx: Math.min(480, Math.max(40, activeDrag.origW + dx)),
          alturaPx: Math.min(320, Math.max(24, (p.alturaPx ?? 48) + dy)),
        });
      }
    }
    function onUp() {
      setDrag(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, normalized, pctFromEvent]);

  const previewDoc = useMemo(() => {
    if (previewSrcDoc) return previewSrcDoc;
    if (!previewHtml) return "";
    return buildDocumentPreviewHtml(previewHtml, { orientacao, verticalAlign });
  }, [previewSrcDoc, previewHtml, orientacao, verticalAlign]);

  if (!logos.length) {
    return (
      <p className="text-[11px] text-slate-500">
        Importe logótipos na secção acima para os posicionar no documento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {logos.map((l) => (
          <button
            key={l.id}
            type="button"
            className="flex items-center gap-2 rounded-lg border border-slate-700/40 bg-slate-950/60 px-2 py-1.5 text-left hover:border-slate-500"
            onClick={() => addLogo(l.id)}
          >
            <div className="flex h-8 w-10 items-center justify-center rounded bg-white p-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl(l.id)} alt="" className="max-h-full max-w-full object-contain" />
            </div>
            <span className="text-[10px] text-slate-300">{l.nome}</span>
            <Plus className="h-3 w-3 text-slate-500" />
          </button>
        ))}
      </div>

      <p className="text-[10px] text-slate-500">
        Arraste os logótipos na página A4. Use o canto inferior direito para redimensionar.
      </p>

      <div
        ref={canvasRef}
        className="relative mx-auto w-full max-w-[520px] overflow-hidden rounded-lg border border-slate-600/50 bg-white shadow-inner"
        style={{ aspectRatio: a4AspectRatio(orientacao) }}
        onClick={() => setSelected(null)}
      >
        {previewDoc ? (
          <iframe
            title="Pré-visualização do documento"
            srcDoc={previewDoc}
            className="pointer-events-none absolute inset-0 z-[2] h-full w-full border-0 bg-white"
            sandbox=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-[10px] text-slate-400">
            Pré-visualização do documento
          </div>
        )}

        {normalized.map((p, idx) => {
          const asset = logos.find((l) => l.id === p.logoId);
          const isSelected = selected === idx;
          const zIndex = p.zona === "marca_agua" ? 1 : 4;
          return (
            <div
              key={`${p.logoId}-${idx}`}
              className={cn(
                "absolute touch-none select-none",
                isSelected && "ring-2 ring-blue-500 ring-offset-1",
              )}
              style={{
                left: `${p.xPct ?? 0}%`,
                top: `${p.yPct ?? 0}%`,
                zIndex,
                cursor: drag?.idx === idx ? "grabbing" : "grab",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(idx);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setSelected(idx);
                setDrag({
                  idx,
                  mode: "move",
                  startX: e.clientX,
                  startY: e.clientY,
                  origW: p.larguraPx ?? 140,
                });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl(p.logoId)}
                alt={asset?.nome ?? ""}
                draggable={false}
                className="block max-w-none object-contain"
                style={{
                  width: p.larguraPx ?? 140,
                  height: p.alturaPx ?? 48,
                  opacity: p.opacidade ?? defaultLogoOpacity(p.zona),
                }}
              />
              {isSelected ? (
                <span
                  className="absolute -bottom-1 -right-1 flex h-4 w-4 cursor-se-resize items-center justify-center rounded bg-blue-600 text-white"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDrag({
                      idx,
                      mode: "resize",
                      startX: e.clientX,
                      startY: e.clientY,
                      origW: p.larguraPx ?? 140,
                    });
                  }}
                >
                  <GripVertical className="h-2.5 w-2.5 rotate-90" />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {selected !== null && normalized[selected] ? (
        <LogoControls
          placement={normalized[selected]}
          assetName={logos.find((l) => l.id === normalized[selected]!.logoId)?.nome}
          onPatch={(patch) => update(selected, patch)}
          onRemove={() => remove(selected)}
        />
      ) : null}
    </div>
  );
}

function LogoControls({
  placement,
  assetName,
  onPatch,
  onRemove,
}: {
  placement: DocumentLogoPlacement;
  assetName?: string;
  onPatch: (patch: Partial<DocumentLogoPlacement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-slate-700/40 bg-slate-950/50 p-3 sm:grid-cols-2 lg:grid-cols-4">
      <p className="text-xs text-slate-300 sm:col-span-2 lg:col-span-4">{assetName ?? placement.logoId}</p>
      <label className="space-y-0.5">
        <span className="text-[9px] uppercase text-slate-500">Zona</span>
        <select
          value={placement.zona}
          onChange={(e) => {
            const zona = e.target.value as DocumentLogoZona;
            onPatch({ zona, opacidade: placement.opacidade ?? defaultLogoOpacity(zona) });
          }}
          className="w-full rounded border border-slate-600/60 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          {ZONAS.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-0.5">
        <span className="text-[9px] uppercase text-slate-500">Largura (px)</span>
        <input
          type="number"
          min={24}
          max={480}
          value={placement.larguraPx ?? 140}
          onChange={(e) => onPatch({ larguraPx: Number(e.target.value) })}
          className="w-full rounded border border-slate-600/60 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        />
      </label>
      <label className="space-y-0.5">
        <span className="text-[9px] uppercase text-slate-500">Altura (px)</span>
        <input
          type="number"
          min={16}
          max={320}
          value={placement.alturaPx ?? 48}
          onChange={(e) => onPatch({ alturaPx: Number(e.target.value) })}
          className="w-full rounded border border-slate-600/60 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        />
      </label>
      <label className="space-y-0.5 sm:col-span-2">
        <span className="text-[9px] uppercase text-slate-500">
          Opacidade ({Math.round((placement.opacidade ?? defaultLogoOpacity(placement.zona)) * 100)}%)
        </span>
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round((placement.opacidade ?? defaultLogoOpacity(placement.zona)) * 100)}
          onChange={(e) => onPatch({ opacidade: Number(e.target.value) / 100 })}
          className="w-full"
        />
      </label>
      <div className="flex items-end">
        <Button type="button" size="sm" variant="secondary" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
          Remover
        </Button>
      </div>
    </div>
  );
}
