"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { AuthShell } from "@/components/site/auth-shell";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

export type SessionGoodbyeReason = "expired" | "logout";

type SessionGoodbyeProps = {
  returnTo?: string;
  reason?: SessionGoodbyeReason;
};

const COPY: Record<
  SessionGoodbyeReason,
  { subtitle: string; body: string }
> = {
  expired: {
    subtitle:
      "A tua sessão expirou (limite de segurança de cerca de 1 hora). Inicia sessão novamente para continuar no portal.",
    body: "Por motivos de segurança, o acesso ao CRM e restantes módulos foi encerrado automaticamente.",
  },
  logout: {
    subtitle: "Terminaste sessão com sucesso.",
    body: "Obrigado por utilizares o NexiForma. Quando quiseres voltar, inicia sessão novamente.",
  },
};

export function sessionGoodbyeHref(returnTo: string, reason: SessionGoodbyeReason = "logout"): string {
  return `/adeus?reason=${reason}&next=${encodeURIComponent(returnTo)}`;
}

export function SessionGoodbyeSkeleton() {
  return (
    <AuthShell title="Adeus" subtitle="A carregar…">
      <div className="space-y-4 animate-pulse">
        <div className="h-14 rounded-xl bg-slate-800/60" />
        <div className="h-11 rounded-lg bg-slate-800/80" />
      </div>
    </AuthShell>
  );
}

export function SessionGoodbyeView({ returnTo, reason = "expired" }: SessionGoodbyeProps) {
  const pathname = usePathname();
  const next = returnTo ?? pathname ?? "/portal";
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const copy = COPY[reason];

  return (
    <AuthShell title="Adeus" subtitle={copy.subtitle}>
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-3.5">
          <p className="text-sm text-slate-300 leading-relaxed">{copy.body}</p>
        </div>
        <Link href={loginHref} className={cn(buttonVariants({ size: "lg" }), "w-full justify-center gap-2")}>
          <LogIn className="h-4 w-4" />
          Iniciar sessão
        </Link>
      </div>
    </AuthShell>
  );
}
