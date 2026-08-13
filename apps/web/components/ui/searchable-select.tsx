"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type SearchableSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
};

export function SearchableSelect({
  label,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Pesquisar…",
  value,
  onChange,
  options,
  allowEmpty = false,
  emptyLabel = "- Nenhum -",
  disabled = false,
  className,
  required,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const display =
    selected?.label ??
    (allowEmpty && !value ? emptyLabel : placeholder);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  React.useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className={cn("relative flex flex-col gap-1.5", className)}>
      {label ? (
        <span className="text-sm font-medium text-slate-300">
          {label}
          {required ? " *" : ""}
        </span>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "ui-field flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-600/60 bg-slate-900/80 px-3 text-sm text-left",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/60",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          !selected && !allowEmpty && "text-slate-500",
          selected && "text-slate-100",
        )}
      >
        <span className="truncate">{display}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute z-50 top-full mt-1 w-full overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl">
          <div className="relative border-b border-slate-700/50 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-700/50 bg-slate-950/80 py-1.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {allowEmpty ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={() => pick("")}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-800/80"
                >
                  {emptyLabel}
                  {!value ? <Check className="h-4 w-4 text-teal-400" /> : null}
                </button>
              </li>
            ) : null}
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-800/80",
                      active ? "bg-slate-800/50 text-slate-100" : "text-slate-300",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint ? <span className="block truncate text-xs text-slate-500">{o.hint}</span> : null}
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0 text-teal-400" /> : null}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-slate-500">Sem resultados.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
