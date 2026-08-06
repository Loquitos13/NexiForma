"use client";

import Link from "next/link";
import { NexiFormaLogoAnimated } from "@/components/brand/NexiFormaLogoAnimated";
import { EntrarButton } from "@/components/site/entrar-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#070b12]/85 border-b border-slate-700/30">
      <div className="max-w-6xl mx-auto px-5 h-16 grid grid-cols-3 items-center gap-4">
        <a
          href="#planos"
          className="justify-self-start text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Planos
        </a>

        <Link
          href="/"
          className="flex items-center justify-self-center group"
          aria-label="NexiForma"
        >
          <NexiFormaLogoAnimated
            size={38}
            variant="reveal"
            loop
            className="group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_16px_rgba(255,71,171,0.32)]"
          />
        </Link>

        <EntrarButton />
      </div>
    </header>
  );
}
