"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Check, Zap } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type Plan = { id: string; code: string; name: string; priceCentsMonthly: number; maxActiveUsers: number | null };
type Sub = { status: string; plan: Plan | null; currentPeriodEnd?: string };

const STATUS_VARIANT: Record<string, "green" | "yellow" | "red" | "default"> = {
  active: "green", trialing: "teal" as any, past_due: "yellow", canceled: "red",
};

export default function BillingPage() {
  const { canManage } = useTenantRole();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      bffFetch("/api/v1/billing/plans", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/billing/subscription", { headers: { accept: "application/json" } }),
    ]);
    if (pRes.ok) setPlans((await pRes.json()) as Plan[]);
    if (sRes.ok) setSub((await sRes.json()) as Sub);
  }, []);

  useEffect(() => {
    void load();
    if (new URLSearchParams(window.location.search).get("success")) setMsg("Subscrição activada com sucesso.");
  }, [load]);

  async function checkout(planCode: string) {
    if (!canManage) return;
    setError(null); setLoadingPlan(planCode);
    const res = await bffFetch("/api/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ planCode }),
    });
    setLoadingPlan(null);
    if (!res.ok) { setError(await parseApiError(res)); return; }
    const data = (await res.json()) as { url?: string; redirectUrl?: string };
    const target = data.url ?? data.redirectUrl;
    if (target) window.location.href = target;
    else { setMsg("Checkout concluído."); await load(); }
  }

  const isCurrent = (code: string) => sub?.plan?.code === code;

  return (
    <>
      <PageHeader
        title="Subscrição"
        description="Planos NexiForma - pagamento via Stripe Checkout."
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      {/* Plano actual */}
      {sub && (
        <Card className="mb-6 border-blue-700/30 bg-gradient-to-r from-blue-900/20 to-slate-900/40">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20">
                <CreditCard className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-slate-100">
                  {sub.plan ? sub.plan.name : "Sem subscrição activa"}
                </div>
                {sub.currentPeriodEnd && (
                  <div className="text-xs text-slate-500">
                    Renova em {new Date(sub.currentPeriodEnd).toLocaleDateString("pt-PT")}
                  </div>
                )}
              </div>
            </div>
            <Badge variant={STATUS_VARIANT[sub.status] ?? "default"}>{sub.status}</Badge>
          </CardContent>
        </Card>
      )}

      {/* Planos */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => {
          const current = isCurrent(p.code);
          return (
            <Card key={p.id} className={cn("relative", current && "border-blue-600/60 ring-1 ring-blue-600/40")}>
              {current && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge variant="blue">Plano actual</Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <CardTitle>{p.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-black text-slate-100">
                    {(p.priceCentsMonthly / 100).toFixed(0)}€
                  </span>
                  <span className="text-sm text-slate-500">/mês</span>
                </div>
                <ul className="space-y-1.5 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    {p.maxActiveUsers ? `Até ${p.maxActiveUsers} utilizadores` : "Utilizadores ilimitados"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Dossiê pedagógico digital
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    Compliance DGERT
                  </li>
                </ul>
                {canManage && (
                  <Button
                    className="w-full"
                    variant={current ? "secondary" : "default"}
                    disabled={current || loadingPlan === p.code}
                    onClick={() => void checkout(p.code)}
                  >
                    {current ? "Plano actual" : loadingPlan === p.code ? "A redirecionar…" : "Subscrever"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
