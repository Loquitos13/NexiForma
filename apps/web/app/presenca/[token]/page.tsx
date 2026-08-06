"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { QrCode } from "lucide-react";
import { AuthShell } from "@/components/site/auth-shell";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

/**
 * Landing pública do QR: encaminha para o check-in do formando.
 * A câmara do SO abre muitas vezes um browser sem a sessão do app -
 * por isso mostramos contexto e um CTA explícito (em vez de redirect cego).
 */
export default function PresencaQrLandingPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const destino = token
    ? `/portal/formando/presenca/${encodeURIComponent(token)}`
    : "/portal/formando";
  const [autoMs, setAutoMs] = useState(2_500);

  useEffect(() => {
    if (!token) return;
    const t = window.setTimeout(() => {
      window.location.assign(destino);
    }, autoMs);
    return () => window.clearTimeout(t);
  }, [destino, token, autoMs]);

  if (!token) {
    return (
      <AuthShell title="Presença" subtitle="Código QR inválido.">
        <Link href="/login" className={cn(buttonVariants(), "w-full justify-center")}>
          Ir para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Registo de presença"
      subtitle="Estás a ser encaminhado para o portal do formando."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-slate-700/50 bg-slate-900/50 p-3 text-sm text-slate-300">
          <QrCode className="h-5 w-5 shrink-0 text-teal-400 mt-0.5" />
          <p className="leading-snug">
            Se a câmara do telemóvel abriu um browser diferente daquele onde já
            estavas autenticado, terás de iniciar sessão outra vez - a sessão
            fica nesse browser (cookie), não na aplicação da câmara.
          </p>
        </div>
        <Link
          href={destino}
          className={cn(buttonVariants(), "w-full justify-center")}
          onClick={() => setAutoMs(60_000)}
        >
          Continuar para marcar presença
        </Link>
        <p className="text-center text-xs text-slate-500">
          Redireccionamento automático em instantes…
        </p>
      </div>
    </AuthShell>
  );
}
