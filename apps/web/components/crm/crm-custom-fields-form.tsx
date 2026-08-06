"use client";

import { useEffect, useState } from "react";
import type { CrmCustomFieldDef } from "@nexiforma/shared";
import { Input, Select } from "@/components/ui";

type Props = {
  defs: CrmCustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
};

export function CrmCustomFieldsForm({ defs, values, onChange, disabled }: Props) {
  const [loaded, setLoaded] = useState(defs);

  useEffect(() => {
    setLoaded(defs);
  }, [defs]);

  if (!loaded.length) return null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-700/40 p-3">
      <p className="text-xs font-medium text-slate-400">Campos personalizados</p>
      {loaded.map((def) => {
        const key = def.key.trim();
        const value = values[key];
        const label = (
          <span className="text-xs text-slate-500">
            {def.label || key}
            {def.required ? " *" : ""}
          </span>
        );

        if (def.type === "select") {
          return (
            <label key={def.id} className="grid gap-1">
              {label}
              <Select
                disabled={disabled}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange({ ...values, [key]: e.target.value })}
              >
                <option value="">-</option>
                {(def.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </label>
          );
        }

        if (def.type === "date") {
          return (
            <label key={def.id} className="grid gap-1">
              {label}
              <Input
                type="date"
                disabled={disabled}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange({ ...values, [key]: e.target.value })}
              />
            </label>
          );
        }

        return (
          <label key={def.id} className="grid gap-1">
            {label}
            <Input
              type={def.type === "number" ? "number" : "text"}
              disabled={disabled}
              value={value != null ? String(value) : ""}
              onChange={(e) =>
                onChange({
                  ...values,
                  [key]: def.type === "number" ? e.target.value : e.target.value,
                })
              }
            />
          </label>
        );
      })}
    </div>
  );
}
