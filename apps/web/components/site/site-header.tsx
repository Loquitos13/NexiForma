"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { bffFetch } from "@/lib/client/bff-fetch";

type SessionHint = { email?: string; role?: string; kind?: string } | null;

export function SiteHeader() {
  const [session, setSession] = useState<SessionHint | undefined>(undefined);

  useEffect(() => {
    void bffFetch("/api/auth/me", { headers: { accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) { setSession(null); return; }
        setSession((await r.json()) as SessionHint);
      })
      .catch(() => setSession(null));
  }, []);

  const dashboardHref =
    session?.kind === "platform" || session?.role === "super_admin"
      ? "/plataforma"
      : "/portal";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#070b12]/85 border-b border-slate-700/30">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <NexiFormaLogoAnimated
            size={38}
            variant="reveal"
            loop
            className="group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_16px_rgba(255,71,171,0.32)]"
          />
          <span className="font-bold text-lg text-slate-100 tracking-tight">NexiForma</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <a href="#funcionalidades" className="text-slate-400 hover:text-slate-200 transition-colors hidden sm:inline">
            Funcionalidades
          </a>
          <a href="#como-funciona" className="text-slate-400 hover:text-slate-200 transition-colors hidden md:inline">
            Como funciona
          </a>
          <a href="#integracoes" className="text-slate-400 hover:text-slate-200 transition-colors hidden lg:inline">
            Integrações
          </a>
          <Link href="/login" className="text-slate-400 hover:text-slate-200 transition-colors">
            Entrar
          </Link>
          {session ? (
            <Link
              href={dashboardHref}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
            >
              Painel
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
            >
              Começar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
