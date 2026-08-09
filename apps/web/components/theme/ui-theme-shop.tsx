"use client";

import type { CSSProperties } from "react";
import { Check, Palette, X } from "lucide-react";
import { UI_THEMES, type UiThemeDef, type UiThemeId } from "@/lib/ui/ui-themes";
import { useUiThemeOptional } from "./ui-theme-provider";

function ThemePreviewCard({
  theme,
  selected,
  onSelect,
}: {
  theme: UiThemeDef;
  selected: boolean;
  onSelect: () => void;
}) {
  const cardStyle = {
    background: theme.bg,
    borderColor: selected ? theme.accent : `${theme.muted}33`,
    boxShadow: selected ? `0 0 0 2px ${theme.accent}66` : undefined,
  } satisfies CSSProperties;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
        selected ? "scale-[1.02]" : "hover:scale-[1.01]"
      }`}
      style={cardStyle}
    >
      {/* Mini mock tipo Chrome wallpaper shop */}
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(800px circle at 20% 0%, ${theme.accentSoft} 0%, ${theme.bg} 55%)`,
          }}
        />
        <div className="absolute inset-2 flex gap-1.5 rounded-lg overflow-hidden shadow-lg border border-black/20">
          <div
            className="w-[28%] flex flex-col gap-1 p-1.5"
            style={{ background: theme.sidebar, color: theme.fg }}
          >
            <div className="h-1.5 w-8 rounded-full opacity-80" style={{ background: theme.accent }} />
            <div className="mt-1 h-1 w-full rounded-full opacity-30" style={{ background: theme.fg }} />
            <div
              className="h-4 rounded-md px-1 flex items-center"
              style={{ background: theme.accentSoft }}
            >
              <div className="h-1 w-3/4 rounded-full" style={{ background: theme.accent }} />
            </div>
            <div className="h-1 w-4/5 rounded-full opacity-25" style={{ background: theme.fg }} />
            <div className="h-1 w-3/5 rounded-full opacity-20" style={{ background: theme.fg }} />
          </div>
          <div className="flex-1 flex flex-col" style={{ background: theme.bg }}>
            <div
              className="h-4 border-b px-1.5 flex items-center gap-1"
              style={{ borderColor: `${theme.muted}33`, background: `${theme.panel}cc` }}
            >
              <div className="h-1.5 w-10 rounded-full opacity-40" style={{ background: theme.fg }} />
              <div className="ml-auto h-2.5 w-2.5 rounded-full" style={{ background: theme.accent }} />
            </div>
            <div className="flex-1 p-1.5 space-y-1.5">
              <div
                className="h-7 rounded-md border p-1"
                style={{ background: theme.panel, borderColor: `${theme.muted}22` }}
              >
                <div className="h-1 w-1/2 rounded-full mb-1" style={{ background: theme.fg }} />
                <div className="h-1 w-2/3 rounded-full opacity-40" style={{ background: theme.muted }} />
              </div>
              <div className="flex gap-1">
                <div
                  className="h-5 flex-1 rounded-md"
                  style={{ background: theme.accentSoft }}
                />
                <div
                  className="h-5 w-8 rounded-md"
                  style={{ background: theme.accent }}
                />
              </div>
            </div>
          </div>
        </div>
        {selected ? (
          <span
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-white shadow"
            style={{ background: theme.accent }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2.5 border-t border-white/5" style={{ background: `${theme.panel}ee` }}>
        <p className="text-xs font-semibold" style={{ color: theme.fg }}>
          {theme.label}
        </p>
        <p className="text-[10px] mt-0.5 leading-snug" style={{ color: theme.muted }}>
          {theme.description}
        </p>
        <div className="mt-2 flex items-center gap-1">
          {[theme.bg, theme.panel, theme.accent, theme.accentSoft].map((c) => (
            <span
              key={c}
              className="h-3 w-3 rounded-full border border-black/20"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </button>
  );
}

export function UiThemeShop() {
  const ctx = useUiThemeOptional();
  if (!ctx || !ctx.shopOpen) return null;

  const { themeId, setThemeId, closeShop } = ctx;

  function pick(id: UiThemeId) {
    setThemeId(id);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Fechar temas"
        onClick={closeShop}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-theme-shop-title"
        className="ui-modal ui-theme-shop relative z-[81] flex max-h-[min(92dvh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
      >
        <div className="ui-modal-header flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-[var(--ui-accent)]" />
              <h2 id="ui-theme-shop-title" className="ui-modal-title text-base font-semibold">
                Temas da plataforma
              </h2>
            </div>
            <p className="ui-modal-desc mt-1 text-sm">
              Escolha um tema pré-definido. Aplica-se só à sua conta, em qualquer entidade.
            </p>
          </div>
          <button
            type="button"
            onClick={closeShop}
            className="ui-modal-close rounded-lg p-1.5"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="ui-themed-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {UI_THEMES.map((theme) => (
              <ThemePreviewCard
                key={theme.id}
                theme={theme}
                selected={themeId === theme.id}
                onSelect={() => pick(theme.id)}
              />
            ))}
          </div>
        </div>

        <div className="ui-modal-header shrink-0 flex justify-end gap-2 border-t px-5 py-3">
          <button
            type="button"
            onClick={closeShop}
            className="ui-btn-primary rounded-lg px-3.5 py-2 text-sm font-medium"
          >
            Concluído
          </button>
        </div>
      </div>
    </div>
  );
}
