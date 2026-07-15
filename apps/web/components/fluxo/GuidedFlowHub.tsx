"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  GraduationCap,
  Layers,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";
import {
  GUIDED_FLOW_CATEGORY_LABEL,
  type GuidedFlowId,
  type GuidedFlowModule,
  visibleGuidedFlowModules,
} from "./guided-flow-modules";

const ICONS: Record<GuidedFlowId, LucideIcon> = {
  "setup-completo": Sparkles,
  "acao-existente": GraduationCap,
  "sessao-existente": Calendar,
  conteudos: Layers,
  dgert: ShieldCheck,
  crm: Users,
  faturacao: Receipt,
  relatorios: BarChart3,
  utilizadores: UserCog,
  plugins: Plug,
  configuracoes: Settings,
};

type Props = {
  onOpenView: (view: "setup-completo" | "conteudos") => void;
};

function FlowCard({ module, onOpenView }: { module: GuidedFlowModule; onOpenView: Props["onOpenView"] }) {
  const Icon = ICONS[module.id];
  const internal = module.view;

  const body = (
    <Card className="h-full border-slate-700/40 bg-slate-900/50 hover:border-blue-500/35 hover:bg-slate-900/80 transition-all group">
      <CardContent className="p-5 flex flex-col h-full">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/15">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-100 text-sm leading-snug">{module.title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{module.description}</p>
          </div>
        </div>
        <span className="mt-auto text-xs font-medium text-blue-400 group-hover:text-blue-300">
          {internal ? "Abrir tutorial →" : "Ir para módulo →"}
        </span>
      </CardContent>
    </Card>
  );

  if (internal) {
    return (
      <button type="button" className="text-left w-full" onClick={() => onOpenView(internal)}>
        {body}
      </button>
    );
  }

  if (module.href) {
    return (
      <Link href={module.href} className="block h-full">
        {body}
      </Link>
    );
  }

  return body;
}

export function GuidedFlowHub({ onOpenView }: Props) {
  const { entitlements, loading } = useTenantEntitlements();
  const { role, canManage } = useTenantRole();

  const modules = visibleGuidedFlowModules({
    ent: entitlements,
    role,
    canManage,
  });

  const byCategory = (["formacao", "negocio", "admin"] as const).map((cat) => ({
    cat,
    items: modules.filter((m) => m.category === cat),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return <p className="text-sm text-slate-500 p-6">A carregar fluxos disponíveis…</p>;
  }

  if (modules.length === 0) {
    return (
      <div className="p-6">
        <PageHeader
          title="Fluxo guiado"
          description="Nenhum módulo activo na subscrição. Active módulos em Facturação / planos."
        />
        <Link href="/portal/billing">
          <Button variant="secondary" size="sm">
            Ver subscrição
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-5xl">
      <PageHeader
        title="Fluxo guiado"
        description="Escolhe um percurso. Só aparecem módulos incluídos no teu plano — sem erros de permissão."
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Workflow className="h-4 w-4" />
            {modules.length} fluxos disponíveis
          </div>
        }
      />

      {byCategory.map(({ cat, items }) => (
        <section key={cat}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {GUIDED_FLOW_CATEGORY_LABEL[cat]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => (
              <FlowCard key={m.id} module={m} onOpenView={onOpenView} />
            ))}
          </div>
        </section>
      ))}

      <Card className="border-violet-500/20 bg-violet-950/20">
        <CardContent className="py-4 flex flex-wrap items-center gap-3">
          <BookOpen className="h-5 w-5 text-violet-400 shrink-0" />
          <p className="text-sm text-slate-300 flex-1 min-w-[200px]">
            Precisas de ajuda contextual? Usa o <strong className="text-slate-100">NexiGuia</strong> no canto
            inferior do ecrã.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function GuidedFlowBackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-800/80 px-6 py-3 bg-slate-950/60">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </div>
  );
}

export function useGuidedFlowView(): [
  "hub" | "setup-completo" | "conteudos",
  (v: "hub" | "setup-completo" | "conteudos") => void,
] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const raw = searchParams.get("v");
  const view =
    raw === "setup-completo" || raw === "conteudos" ? raw : ("hub" as const);

  const setView = (v: "hub" | "setup-completo" | "conteudos") => {
    if (v === "hub") {
      router.push("/portal/fluxo");
      return;
    }
    const q = new URLSearchParams({ v });
    const cursoId = searchParams.get("cursoId");
    if (cursoId) q.set("cursoId", cursoId);
    router.push(`/portal/fluxo?${q.toString()}`);
  };

  return [view, setView];
}
