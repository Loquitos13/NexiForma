"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type TenantAuthPickOption = {
  slug: string;
  legalName: string;
  roleLabel: string;
  logoUrl?: string;
  initials: string;
};

type TenantAuthPickModalProps = {
  open: boolean;
  options: TenantAuthPickOption[];
  value: string;
  onChange: (slug: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  subtitle?: string;
  confirmLabel?: string;
};

function TenantPickAvatar({
  name,
  logoUrl,
  initials,
  large,
}: {
  name: string;
  logoUrl?: string;
  initials: string;
  large?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(logoUrl?.trim()) && !imgFailed;
  const size = large ? "h-20 w-20 text-xl" : "h-12 w-12 text-sm";

  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-600/40 bg-gradient-to-br from-slate-800 to-slate-900 shadow-inner`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-2"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="font-semibold tracking-wide text-slate-100" aria-hidden>
          {initials}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function TenantAuthPickModal({
  open,
  options,
  value,
  onChange,
  onConfirm,
  onCancel,
  busy,
  subtitle,
  confirmLabel = "Continuar",
}: TenantAuthPickModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open || !options.length) return null;

  const cols =
    options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tenant-pick-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
        onClick={onCancel}
        aria-label="Fechar seleção de entidade"
      />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-900/95 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-3 border-b border-slate-700/50 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="tenant-pick-title" className="text-lg font-semibold text-slate-50">
              Quem está a entrar?
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {subtitle ?? "Escolha a entidade formadora para continuar."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <ul className={`grid ${cols} gap-4`}>
            {options.map((t) => {
              const selected = value === t.slug;
              const initials = t.initials?.trim() || t.legalName.slice(0, 2).toUpperCase();
              return (
                <li key={t.slug}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onChange(t.slug)}
                    className={`group flex h-full w-full flex-col items-center rounded-2xl border px-4 py-5 text-center transition-all duration-200 ${
                      selected
                        ? "border-amber-400/70 bg-gradient-to-b from-amber-950/40 to-slate-900/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25)] scale-[1.02]"
                        : "border-slate-700/60 bg-slate-900/50 hover:border-slate-500/70 hover:bg-slate-800/60 hover:scale-[1.02]"
                    } ${busy ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <TenantPickAvatar
                      name={t.legalName}
                      logoUrl={t.logoUrl}
                      initials={initials}
                      large
                    />
                    <span className="mt-4 line-clamp-2 text-sm font-semibold leading-snug text-slate-100">
                      {t.legalName}
                    </span>
                    <span className="mt-2 inline-flex rounded-full bg-slate-800/90 px-2.5 py-0.5 text-xs text-slate-300">
                      {t.roleLabel}
                    </span>
                    <span
                      className={`mt-3 flex h-5 w-5 items-center justify-center rounded-full border ${
                        selected
                          ? "border-amber-400 bg-amber-400"
                          : "border-slate-500/60 bg-transparent group-hover:border-slate-400"
                      }`}
                      aria-hidden
                    >
                      {selected ? <span className="h-2 w-2 rounded-full bg-slate-950" /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-700/50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !value.trim()}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "A processar…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
