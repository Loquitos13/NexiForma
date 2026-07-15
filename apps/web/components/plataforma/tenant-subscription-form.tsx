"use client";

import {
  BILLING_ADDON_CODES,
  BILLING_ADDON_LABELS,
  BILLING_PLAN_CODES,
  BILLING_PLAN_LABELS,
  MODULAR_PLAN_CODE,
  PLAN_NEGOTIABLE_ADDONS,
  STANDALONE_PURCHASABLE_ADDONS,
  type BillingAddonCode,
  type BillingPlanCode,
} from "@nexiforma/shared";
import { cn } from "@/lib/ui/cn";

export type TenantSubscriptionFormValue = {
  planCode: BillingPlanCode;
  customAddons: BillingAddonCode[];
};

type Props = {
  value: TenantSubscriptionFormValue;
  onChange: (value: TenantSubscriptionFormValue) => void;
  inputClass?: string;
  compact?: boolean;
};

const defaultInputClass =
  "w-full px-3 py-2 rounded-lg bg-[#0c0a14] border border-purple-500/15 text-sm text-slate-200 outline-none focus:border-purple-500/40 transition-colors";

function selectableAddons(planCode: BillingPlanCode): BillingAddonCode[] {
  if (planCode === MODULAR_PLAN_CODE) {
    return [...STANDALONE_PURCHASABLE_ADDONS];
  }
  return [...(PLAN_NEGOTIABLE_ADDONS[planCode as keyof typeof PLAN_NEGOTIABLE_ADDONS] ?? [])];
}

export function TenantSubscriptionForm({ value, onChange, inputClass, compact }: Props) {
  const cls = inputClass ?? defaultInputClass;
  const isModular = value.planCode === MODULAR_PLAN_CODE;
  const addons = selectableAddons(value.planCode);

  function setPlanCode(planCode: BillingPlanCode) {
    const nextAddons = value.customAddons.filter((a) => selectableAddons(planCode).includes(a));
    onChange({ planCode, customAddons: nextAddons });
  }

  function toggleAddon(code: BillingAddonCode) {
    const next = value.customAddons.includes(code)
      ? value.customAddons.filter((a) => a !== code)
      : [...value.customAddons, code];
    onChange({ ...value, customAddons: next });
  }

  return (
    <div className={cn("space-y-3", compact ? "" : "rounded-xl border border-purple-500/15 p-4 bg-purple-500/5")}>
      {!compact ? (
        <div>
          <h3 className="text-sm font-semibold text-purple-200">Plano e módulos</h3>
          <p className="text-xs text-slate-500 mt-1">
            O super admin activa o plano Core ou módulos avulsos. O tenant só acede ao que estiver activo.
          </p>
        </div>
      ) : null}

      <label className="grid gap-1 text-xs text-slate-400">
        Plano
        <select
          className={cls}
          value={value.planCode}
          onChange={(e) => setPlanCode(e.target.value as BillingPlanCode)}
        >
          {BILLING_PLAN_CODES.map((code) => (
            <option key={code} value={code}>
              {BILLING_PLAN_LABELS[code]}
            </option>
          ))}
        </select>
      </label>

      {isModular ? (
        <p className="text-xs text-teal-300/90 rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2">
          Plano só-módulos: seleccione pelo menos um módulo. Não inclui gestão formativa Core (LMS, dossiê,
          acções).
        </p>
      ) : value.planCode === "enterprise" ? (
        <p className="text-xs text-slate-500">
          Enterprise inclui todos os módulos nativamente. Add-ons extra só se negociado.
        </p>
      ) : addons.length > 0 ? (
        <p className="text-xs text-slate-500">Add-ons opcionais para além do plano Core seleccionado.</p>
      ) : null}

      {addons.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-slate-400">
            {isModular ? "Módulos activos *" : "Add-ons activos"}
          </legend>
          <div className="flex flex-wrap gap-2">
            {addons.map((code) => {
              const active = value.customAddons.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleAddon(code)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-purple-400/50 bg-purple-500/15 text-purple-200"
                      : "border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200",
                  )}
                >
                  {BILLING_ADDON_LABELS[code]}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {isModular && value.customAddons.length === 0 ? (
        <p className="text-xs text-amber-400">Seleccione pelo menos um módulo.</p>
      ) : null}
    </div>
  );
}

export function parseCustomAddons(raw: unknown): BillingAddonCode[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is BillingAddonCode =>
    typeof v === "string" && (BILLING_ADDON_CODES as readonly string[]).includes(v),
  );
}
