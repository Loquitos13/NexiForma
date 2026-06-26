"use client";

import Link from "next/link";
import { AuthShell } from "@/components/site/auth-shell";

export default function AcessoNegadoPage() {
  return (
    <AuthShell
      title="Acesso negado"
      subtitle="Não tens permissão para aceder a esta área."
      footer={
        <p className="mt-5 text-center text-sm text-slate-500">
          <Link href="/login" className="text-slate-400 hover:text-slate-200 transition-colors">
            Voltar ao login
          </Link>
        </p>
      }
    >
      <div className="rounded-xl bg-red-950/30 border border-red-500/25 px-4 py-4 text-sm text-red-200/90">
        Esta secção está reservada ao teu perfil de acesso. Se precisares de mais permissões, contacta
        o gestor da entidade ou a equipa NexiForma.
      </div>
    </AuthShell>
  );
}
