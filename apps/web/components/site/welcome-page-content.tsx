"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  GraduationCap,
  Plug,
  Receipt,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { NexiFormaHeroTitle } from "@/components/brand/NexiFormaHeroTitle";
import { ScrollReveal } from "@/components/site/scroll-reveal";

const features: Array<{
  color: string;
  icon: LucideIcon;
  title: string;
  body: string;
}> = [
  {
    color: "text-blue-400",
    icon: ClipboardCheck,
    title: "Dossiê técnico-pedagógico",
    body: "14 documentos automatizados num clique quando os requisitos DGERT estão cumpridos - auditorias que costumam levar semanas ou meses, prontas em minutos.",
  },
  {
    color: "text-teal-400",
    icon: GraduationCap,
    title: "LMS e assiduidade",
    body: "Conteúdos SCORM, presenças automáticas via Zoom/Teams, quizzes e portal dedicado ao formando.",
  },
  {
    color: "text-purple-400",
    icon: TrendingUp,
    title: "CRM comercial",
    body: "Leads, propostas, entidades B2B, contratos e pipeline comercial integrado na operação formativa.",
  },
  {
    color: "text-green-400",
    icon: Receipt,
    title: "Faturação certificada",
    body: "Faturas AT, SAF-T PT, séries documentais e KPIs de faturação no painel CRM.",
  },
  {
    color: "text-amber-400",
    icon: Plug,
    title: "Integrações oficiais",
    body: "SIGO (DGEEC), Autoridade Tributária, CMD para assinatura qualificada e billing Stripe.",
  },
  {
    color: "text-pink-400",
    icon: ShieldCheck,
    title: "Enterprise & RGPD",
    body: "Multi-tenant com MFA, SSO OIDC, chaves API, auditoria e exportação de dados pessoais.",
  },
];

const steps = [
  {
    n: "01",
    title: "Planeia a ação",
    body: "Define UFCD, formadores, calendário e matrículas num único fluxo operacional.",
  },
  {
    n: "02",
    title: "Executa com rasto",
    body: "Sumários, presenças, conteúdos LMS e assinaturas ficam registados automaticamente.",
  },
  {
    n: "03",
    title: "Exporta e factura",
    body: "Gera exports SIGO, certificados CMD e documentos fiscais sem duplicar trabalho.",
  },
  {
    n: "04",
    title: "Passa a inspeção",
    body: "Dossiê completo, trilho de auditoria e evidências prontas para a DGERT.",
  },
];

const integrations = [
  { name: "SIGO", desc: "Export JSON, CSV e API" },
  { name: "AT", desc: "Faturação e SAF-T PT" },
  { name: "CMD", desc: "Assinatura qualificada" },
  { name: "Stripe", desc: "Subscrições SaaS" },
  { name: "Zoom / Teams", desc: "Presenças automáticas" },
  { name: "SCORM", desc: "Conteúdos e progresso" },
];

const audiences = [
  {
    title: "Entidades formadoras certificadas",
    points: ["Operação multi-ação", "Controlo de formadores", "Dossiê DGERT"],
  },
  {
    title: "Centros de formação B2B",
    points: ["CRM e propostas", "Contratos e faturação", "Portal do cliente"],
  },
  {
    title: "Equipas pedagógicas",
    points: ["Portal do formador", "Calendário e sessões", "Avaliações e certificados"],
  },
];

export function WelcomePageContent() {
  return (
    <>
      {/* Hero */}
      <section className="flex-1 max-w-6xl mx-auto w-full px-5 py-16 lg:py-24 grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/25 text-blue-300 mb-5 tracking-wide">
            Certificação DGERT · SaaS B2B
          </span>
          <NexiFormaHeroTitle />
          <p className="text-base sm:text-lg text-slate-400 max-w-xl mb-4 leading-relaxed">
            Plataforma completa para entidades formadoras certificadas em Portugal. Automatiza
            dossiês pedagógicos, presenças, exports SIGO, CRM comercial e faturação AT - com
            segurança enterprise e isolamento multi-tenant.
          </p>
          <p className="text-sm text-slate-500 max-w-xl mb-7 leading-relaxed">
            Do primeiro contacto comercial à inspeção DGERT: leads, propostas, ações formativas,
            certificados CMD e documentos fiscais num só sistema.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 hover:brightness-110 transition-all"
            >
              Entrar no portal
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a
              href="#funcionalidades"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-600/60 text-slate-300 font-semibold text-sm hover:border-slate-500 hover:text-slate-100 transition-all"
            >
              Ver funcionalidades
            </a>
          </div>
        </div>

        <ScrollReveal delay={120}>
          <div className="rounded-2xl bg-slate-900/60 border border-slate-700/30 p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-slate-200 mb-1">Tudo o que a inspeção exige</h2>
            <p className="text-xs text-slate-500 mb-4">
              Evidências digitais, trilho de auditoria e conformidade regulatória.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/20">
                <p className="text-xl font-bold text-green-400">100%</p>
                <p className="text-xs text-slate-500 mt-0.5">Dossiê digital auditável</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/20">
                <p className="text-xl font-bold text-blue-400">SIGO</p>
                <p className="text-xs text-slate-500 mt-0.5">Export JSON, CSV e API</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/20">
                <p className="text-xl font-bold text-teal-400">LMS</p>
                <p className="text-xs text-slate-500 mt-0.5">SCORM, Zoom e Teams</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/20">
                <p className="text-xl font-bold text-purple-400">MFA</p>
                <p className="text-xs text-slate-500 mt-0.5">Segurança para gestores</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="max-w-6xl mx-auto w-full px-5 pb-20">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Como funciona</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm">
              Um fluxo contínuo da prospeção comercial à certificação - sem folhas de cálculo
              paralelas nem pastas partilhadas.
            </p>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <ScrollReveal key={step.n} delay={i * 80}>
              <div className="h-full p-5 rounded-2xl bg-slate-900/40 border border-slate-700/30">
                <span className="text-xs font-bold text-blue-400/80 tracking-widest">{step.n}</span>
                <h3 className="font-semibold text-slate-100 mt-2 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="funcionalidades" className="max-w-6xl mx-auto w-full px-5 pb-20">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Funcionalidades</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm">
              Desenhado para entidades formadoras certificadas - do planeamento pedagógico à
              operação comercial e fiscal.
            </p>
          </div>
        </ScrollReveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
            <ScrollReveal key={f.title} delay={i * 60}>
              <div className="group h-full p-6 rounded-2xl bg-slate-900/50 border border-slate-700/30 hover:border-blue-500/30 hover:-translate-y-0.5 transition-all duration-300">
                <div
                  className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/70 border border-slate-700/30 ${f.color}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </div>
                <h3 className="font-semibold text-slate-100 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* Integrações */}
      <section id="integracoes" className="max-w-6xl mx-auto w-full px-5 pb-20">
        <ScrollReveal>
          <div className="rounded-2xl border border-slate-700/30 bg-slate-900/35 p-8 lg:p-10">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">Integrações nativas</h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Ligações reais com serviços oficiais e ferramentas do dia-a-dia. Sem mocks em
                  produção - cada integração activa-se com credenciais válidas ou fica
                  explicitamente desactivada.
                </p>
                <p className="text-xs text-slate-600">
                  API pública documentada via OpenAPI para tenants enterprise.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {integrations.map((item, i) => (
                  <ScrollReveal key={item.name} delay={i * 50}>
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/25 text-center">
                      <p className="font-semibold text-slate-200 text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Para quem */}
      <section id="para-quem" className="max-w-6xl mx-auto w-full px-5 pb-20">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Para quem é</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">
              Perfis distintos, mesma plataforma - cada um com o portal e permissões adequados.
            </p>
          </div>
        </ScrollReveal>
        <div className="grid md:grid-cols-3 gap-5">
          {audiences.map((a, i) => (
            <ScrollReveal key={a.title} delay={i * 90}>
              <div className="h-full p-6 rounded-2xl bg-slate-900/45 border border-slate-700/30">
                <h3 className="font-semibold text-slate-100 mb-4">{a.title}</h3>
                <ul className="space-y-2">
                  {a.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-slate-500">
                      <span className="text-teal-400 mt-0.5 shrink-0">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Confiança */}
      <section className="max-w-6xl mx-auto w-full px-5 pb-20">
        <ScrollReveal>
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            <div className="p-5 rounded-xl border border-slate-700/25 bg-slate-900/30">
              <p className="text-2xl font-bold text-slate-100">Multi-tenant</p>
              <p className="text-xs text-slate-500 mt-1">Isolamento por entidade formadora</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-700/25 bg-slate-900/30">
              <p className="text-2xl font-bold text-slate-100">RGPD</p>
              <p className="text-xs text-slate-500 mt-1">Exportação e gestão de dados pessoais</p>
            </div>
            <div className="p-5 rounded-xl border border-slate-700/25 bg-slate-900/30">
              <p className="text-2xl font-bold text-slate-100">Auditoria</p>
              <p className="text-xs text-slate-500 mt-1">Trilho completo de acções críticas</p>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <div className="max-w-6xl mx-auto w-full px-5 pb-16">
        <ScrollReveal>
          <div className="rounded-2xl bg-gradient-to-r from-blue-600/10 via-blue-600/5 to-teal-600/10 border border-blue-500/20 px-8 py-10 text-center">
            <h2 className="text-xl font-bold text-slate-100 mb-2">
              Pronto para digitalizar a formação certificada?
            </h2>
            <p className="text-sm text-slate-400 mb-2 max-w-lg mx-auto">
              Acede ao portal da tua entidade ou contacta a equipa NexiForma para onboarding e
              configuração das integrações oficiais.
            </p>
            <p className="text-xs text-slate-600 mb-6 max-w-md mx-auto">
              Suporte a MFA, SSO enterprise, chaves API e ambiente multi-tenant desde o primeiro dia.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm hover:shadow-lg hover:shadow-blue-500/20 transition-all"
            >
              Aceder ao portal
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
