"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, CornerDownLeft } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import type { GuideSearchHit } from "@nexiforma/shared";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { isPortalPathAllowed } from "@/lib/ui/nav-items";

type SearchResponse = {
  hits: GuideSearchHit[];
  source: "local" | "ai";
  hint?: string;
};

type Props = {
  pathname: string;
  className?: string;
};

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "AbortError")
  );
}

export function PortalGlobalSearch({ pathname, className }: Props) {
  const router = useRouter();
  const { role } = useTenantRole();
  const { entitlements } = useTenantEntitlements();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hits, setHits] = useState<GuideSearchHit[]>([]);
  const [source, setSource] = useState<"local" | "ai">("local");
  const [hint, setHint] = useState<string | null>(null);

  const visibleHits = useMemo(
    () =>
      hits.filter((hit) =>
        isPortalPathAllowed(role, hit.href, entitlements ?? undefined),
      ),
    [hits, role, entitlements],
  );

  /** Registos primeiro, depois funcionalidades - índices alinhados com activeIndex. */
  const orderedHits = useMemo(() => {
    const registos = visibleHits.filter((h) => h.kind === "registo");
    const funcionalidades = visibleHits.filter((h) => h.kind !== "registo");
    return [...registos, ...funcionalidades];
  }, [visibleHits]);

  const registoCount = useMemo(
    () => orderedHits.filter((h) => h.kind === "registo").length,
    [orderedHits],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 280);
    return () => window.clearTimeout(t);
  }, [query]);

  const fetchHits = useCallback(
    async (q: string, signal: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ pathname });
        if (q) params.set("q", q);
        const res = await bffFetch(`/api/v1/guide/search?${params.toString()}`, {
          headers: { accept: "application/json" },
          signal,
        });
        if (signal.aborted) return;
        if (!res.ok) {
          setHits([]);
          setHint(null);
          return;
        }
        const data = (await res.json()) as SearchResponse;
        if (signal.aborted) return;
        setHits(data.hits);
        setSource(data.source);
        setHint(data.hint ?? null);
        setActiveIndex(0);
      } catch (err) {
        if (signal.aborted || isAbortError(err)) return;
        setHits([]);
        setHint(null);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    void fetchHits(debounced, ac.signal);
    return () => {
      ac.abort();
    };
  }, [debounced, open, fetchHits]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(orderedHits.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && orderedHits[activeIndex]) {
      e.preventDefault();
      navigate(orderedHits[activeIndex].href);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showPanel = open && (loading || orderedHits.length > 0 || debounced.length > 0);

  function renderHit(hit: GuideSearchHit, index: number) {
    return (
      <li key={`${hit.kind ?? "f"}-${hit.href}-${index}`}>
        <button
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={`flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors ${
            index === activeIndex ? "bg-violet-500/15" : "hover:bg-slate-800/60"
          }`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => navigate(hit.href)}
        >
          <span className="flex items-center gap-2">
            {hit.category ? (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {hit.category}
              </span>
            ) : null}
            <span className="text-sm font-medium text-slate-100">{hit.label}</span>
          </span>
          <span className="text-xs leading-snug text-slate-400">{hit.description}</span>
        </button>
      </li>
    );
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Pesquisar no portal"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Pesquisar propostas, clientes, leads…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-9 w-full rounded-xl border border-slate-700/60 bg-slate-900/80 pl-9 pr-16 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-700/80 bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">
          Ctrl K
        </kbd>
      </div>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/95 shadow-2xl backdrop-blur-md"
        >
          {loading ? (
            <p className="px-4 py-3 text-xs text-slate-500">A pesquisar…</p>
          ) : orderedHits.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-500">
              Sem resultados. Experimente um código de proposta (ex. PROP-…), NIF, nome de cliente
              ou «leads».
            </p>
          ) : (
            <ul className="max-h-[min(420px,55vh)] overflow-y-auto py-1">
              {source === "ai" && hint ? (
                <li className="border-b border-slate-800/80 px-4 py-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-violet-400">
                    <Sparkles className="h-3 w-3" />
                    Sugestão IA
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{hint}</p>
                </li>
              ) : null}

              {registoCount > 0 ? (
                <li className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-teal-400/90">
                  Registos
                </li>
              ) : null}
              {orderedHits.slice(0, registoCount).map((hit, i) => renderHit(hit, i))}

              {orderedHits.length > registoCount ? (
                <li className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Funcionalidades
                </li>
              ) : null}
              {orderedHits.slice(registoCount).map((hit, i) => renderHit(hit, registoCount + i))}
            </ul>
          )}
          {orderedHits.length > 0 ? (
            <div className="flex items-center gap-1 border-t border-slate-800/80 px-3 py-2 text-[10px] text-slate-600">
              <CornerDownLeft className="h-3 w-3" />
              Enter para abrir
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
