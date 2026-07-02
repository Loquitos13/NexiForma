"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BILLING_ADDON_CODES,
  BILLING_ADDON_LABELS,
  BILLING_PLAN_CODES,
  BILLING_PLAN_LABELS,
  type BillingAddonCode,
  type BillingPlanCode,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { pushToast } from "@/components/ui/toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/ui/cn";

export type SalesContactDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPlano?: BillingPlanCode | "custom";
  defaultAddons?: BillingAddonCode[];
};

const PLAN_OPTIONS: Array<{ value: BillingPlanCode | "custom"; label: string }> = [
  ...BILLING_PLAN_CODES.map((code) => ({ value: code, label: BILLING_PLAN_LABELS[code] })),
  { value: "custom", label: "Pacote personalizado" },
];

export function SalesContactDialog({
  open,
  onOpenChange,
  defaultPlano,
  defaultAddons = [],
}: SalesContactDialogProps) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [plano, setPlano] = useState<BillingPlanCode | "custom" | "">(
    defaultPlano ?? "",
  );
  const [addons, setAddons] = useState<BillingAddonCode[]>(defaultAddons);
  const [mensagem, setMensagem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setPlano(defaultPlano ?? "");
      setAddons(defaultAddons);
    }
  }, [open, defaultPlano, defaultAddons]);

  const toggleAddon = useCallback((code: BillingAddonCode) => {
    setAddons((prev) =>
      prev.includes(code) ? prev.filter((a) => a !== code) : [...prev, code],
    );
  }, []);

  const resetAndClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!nome.trim() || !email.trim()) {
        pushToast("error", "Indique nome e email para contacto.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await bffFetch("/api/v1/public/vendas/contacto", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            nome: nome.trim(),
            email: email.trim(),
            empresa: empresa.trim() || undefined,
            telefone: telefone.trim() || undefined,
            planoInteresse: plano || undefined,
            addonsInteresse: addons.length ? addons : undefined,
            mensagem: mensagem.trim() || undefined,
            origem: "welcome",
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { message?: string } | null;
          pushToast("error", err?.message ?? "Não foi possível enviar o pedido.");
          return;
        }
        pushToast("success", "Pedido enviado. A equipa comercial entrará em contacto em breve.");
        setNome("");
        setEmail("");
        setEmpresa("");
        setTelefone("");
        setMensagem("");
        setAddons(defaultAddons);
        setPlano(defaultPlano ?? "");
        resetAndClose();
      } catch {
        pushToast("error", "Erro de ligação. Tente novamente.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      addons,
      defaultAddons,
      defaultPlano,
      email,
      empresa,
      mensagem,
      nome,
      plano,
      resetAndClose,
      telefone,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Falar com vendas"
        description="Conte-nos sobre a sua entidade formadora. Respondemos com uma proposta adaptada ao modelo Core + Add-ons."
        className="max-w-xl"
      >
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Nome *</span>
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                autoComplete="name"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Email *</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                autoComplete="email"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Empresa</span>
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                autoComplete="organization"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-400">Telefone</span>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                autoComplete="tel"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Plano de interesse</span>
            <select
              value={plano}
              onChange={(e) =>
                setPlano(e.target.value as BillingPlanCode | "custom" | "")
              }
              className="w-full rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            >
              <option value="">Selecionar…</option>
              {PLAN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-400">Add-ons de interesse</legend>
            <div className="flex flex-wrap gap-2">
              {BILLING_ADDON_CODES.map((code) => {
                const active = addons.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleAddon(code)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-blue-500/50 bg-blue-500/15 text-blue-200"
                        : "border-slate-700/60 text-slate-400 hover:border-slate-600 hover:text-slate-200",
                    )}
                  >
                    {BILLING_ADDON_LABELS[code]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Mensagem</span>
            <textarea
              rows={4}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Nº de formandos, integrações necessárias, prazo de arranque…"
              className="w-full resize-y rounded-lg border border-slate-700/60 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </label>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-blue-500/20 disabled:opacity-60"
            >
              {submitting ? "A enviar…" : "Pedir contacto comercial"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
