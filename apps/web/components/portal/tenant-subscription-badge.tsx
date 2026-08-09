"use client";

import Link from "next/link";
import { BILLING_PLAN_LABELS, type BillingPlanCode } from "@nexiforma/shared";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { cn } from "@/lib/ui/cn";

function planLabel(code: string | undefined): string {
  if (!code) return "-";
  if (code === "modular") return "Modular";
  if (code in BILLING_PLAN_LABELS) {
    return BILLING_PLAN_LABELS[code as BillingPlanCode];
  }
  return code;
}

function planTone(code: string | undefined): string {
  switch (code) {
    case "starter":
      return "plan-starter";
    case "pro":
      return "plan-pro";
    case "enterprise":
      return "plan-enterprise";
    case "modular":
      return "plan-modular";
    default:
      return "plan-default";
  }
}

/** Badge compacto do plano - cor e shimmer conforme o tipo de subscrição. */
export function TenantSubscriptionBadge({ className }: { className?: string }) {
  const { entitlements, loading } = useTenantEntitlements();
  const code = entitlements?.planCode;
  const label = planLabel(code);
  const tone = planTone(code);

  return (
    <Link
      href="/portal/billing"
      className={cn("ui-plan-badge", tone, className)}
      title={`Plano ${label}`}
    >
      <span className="ui-plan-badge-text">
        {loading && !entitlements ? "…" : label}
      </span>
    </Link>
  );
}
