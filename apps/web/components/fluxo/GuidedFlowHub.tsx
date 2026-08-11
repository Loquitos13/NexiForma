"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  GraduationCap,
  Layers,
  Plug,
  QrCode,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  Users,
  Video,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTenantEntitlements } from "@/lib/client/use-tenant-entitlements";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { useActiveGuidedFlow } from "@/lib/client/active-guided-flow-context";
import { Button, Card, CardContent, PageHeader } from "@/components/ui";
import {
  audienceFromRole,
  getGuidedFlowById,
  GUIDED_FLOW_AUDIENCE_LABEL,
  GUIDED_FLOW_CATEGORY_LABEL,
  isInteractiveGuidedView,
  type GuidedFlowInteractiveView,
  type GuidedFlowModule,
  visibleGuidedFlowModules,
} from "./guided-flow-modules";

const ICONS: Record<string, LucideIcon> = {
  "crm-criar-lead": Users,
  "crm-nota-comercial": ClipboardList,
  "crm-calendario": Calendar,
  "crm-proposta": FileText,
  "crm-cliente": Users,
  "crm-dashboard": Sparkles,
  faturacao: Receipt,
  "setup-completo": Sparkles,
  "formacao-criar-curso": BookOpen,
  "formacao-criar-acao": GraduationCap,
  "formacao-adicionar-formandos": Users,
  "formacao-atribuir-formadores": UserCheck,
  "formacao-cronograma": Calendar,
  "formacao-sumario": FileText,
  "formacao-pauta": ClipboardList,
  "formacao-sessao-presencial": QrCode,
  "formacao-sessao-online": Video,
  "formacao-conteudos-lms": Layers,
  "formacao-libertar-lms": Layers,
  "formacao-dgert": ShieldCheck,
  "formador-perfil": UserCheck,
  "formador-calendario-sessoes": Calendar,
  "formador-presenca-qr": QrCode,
  "formando-perfil": UserCheck,
  "formando-inscricao": BookOpen,
  "formando-aprendizagem": GraduationCap,
  utilizadores: UserCog,
  plugins: Plug,
  configuracoes: Settings,
  relatorios: BarChart3,
};

type OpenTarget =
  | { kind: "interactive"; view: GuidedFlowInteractiveView }
  | { kind: "guide"; id: string };

type Props = {
  onOpen: (target: OpenTarget) => void;
};

function FlowCard({ module, onOpen }: { module: GuidedFlowModule; onOpen: Props["onOpen"] }) {
  const Icon = ICONS[module.id] ?? Workflow;
  const hasGuide = Boolean(module.steps?.length);
  const interactive = module.view;

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
          {interactive || hasGuide ? "Abrir guia →" : "Ir para módulo →"}
        </span>
      </CardContent>
    </Card>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className="text-left w-full"
        onClick={() => onOpen({ kind: "interactive", view: interactive })}
      >
        {body}
      </button>
    );
  }

  if (hasGuide) {
    return (
      <button
        type="button"
        className="text-left w-full"
        onClick={() => onOpen({ kind: "guide", id: module.id })}
      >
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

export function GuidedFlowHub({ onOpen }: Props) {
  const { entitlements, loading } = useTenantEntitlements();
  const { role, canManage, canManageFormacao, canManageCrm, canManageFaturacao } =
    useTenantRole();
  const audience = audienceFromRole(role);

  const modules = visibleGuidedFlowModules({
    ent: entitlements,
    role,
    canManage,
    canManageFormacao,
    canManageCrm,
    canManageFaturacao,
  });

  const byCategory = (["formacao", "negocio", "admin"] as const)
    .map((cat) => ({
      cat,
      items: modules.filter((m) => m.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  if (loading) {
    return <p className="text-sm text-slate-500 p-6">A carregar fluxos disponíveis…</p>;
  }

  if (modules.length === 0) {
    return (
      <div className="p-6">
        <PageHeader
          title="Fluxo guiado"
          description="Nenhum fluxo disponível para o teu papel ou subscrição."
        />
        {canManage ? (
          <Link href="/portal/billing">
            <Button variant="secondary" size="sm">
              Ver subscrição
            </Button>
          </Link>
        ) : null}
      </div>
    );
  }

  const { activeModule, closeFlow } = useActiveGuidedFlow();

  return (
    <div className="space-y-8 p-6 max-w-5xl">
      <PageHeader
        title="Fluxo guiado"
        description={
          audience
            ? `Percursos para ${GUIDED_FLOW_AUDIENCE_LABEL[audience].toLowerCase()}. Só vês o que o teu papel e plano permitem.`
            : "Escolhe um percurso alinhado ao teu papel e aos módulos do plano."
        }
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Workflow className="h-4 w-4" />
            {modules.length} fluxos disponíveis
          </div>
        }
      />

      {activeModule ? (
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-teal-950/30 p-4 shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-300">Fluxo em progresso no NexiGuia</p>
              <p className="text-sm font-semibold text-slate-100">{activeModule.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen({ kind: "guide", id: activeModule.id })}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Ver passos
            </button>
            <button
              type="button"
              onClick={closeFlow}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Parar
            </button>
          </div>
        </div>
      ) : null}

      {byCategory.map(({ cat, items }) => (
        <section key={cat}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {GUIDED_FLOW_CATEGORY_LABEL[cat]}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((m) => (
              <FlowCard key={m.id} module={m} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}

      <Card className="border-violet-500/20 bg-violet-950/20">
        <CardContent className="py-4 flex flex-wrap items-center gap-3">
          <BookOpen className="h-5 w-5 text-violet-400 shrink-0" />
          <p className="text-sm text-slate-300 flex-1 min-w-[200px]">
            Precisas de ajuda contextual? Usa o <strong className="text-slate-100">NexiGuia</strong> no
            canto inferior do ecrã.
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

export type GuidedFlowRouteView =
  | { kind: "hub" }
  | { kind: "interactive"; view: GuidedFlowInteractiveView }
  | { kind: "guide"; module: GuidedFlowModule };

export function useGuidedFlowView(): [GuidedFlowRouteView, (target: OpenTarget | "hub") => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const raw = searchParams.get("v");
  const guideId = searchParams.get("id");

  let current: GuidedFlowRouteView = { kind: "hub" };
  if (isInteractiveGuidedView(raw)) {
    current = { kind: "interactive", view: raw };
  } else if (raw === "guide" && guideId) {
    const module = getGuidedFlowById(guideId);
    if (module?.steps?.length) current = { kind: "guide", module };
  }

  const setView = (target: OpenTarget | "hub") => {
    if (target === "hub") {
      router.push("/portal/fluxo");
      return;
    }
    if (target.kind === "interactive") {
      const q = new URLSearchParams({ v: target.view });
      const cursoId = searchParams.get("cursoId");
      if (cursoId) q.set("cursoId", cursoId);
      router.push(`/portal/fluxo?${q.toString()}`);
      return;
    }
    router.push(`/portal/fluxo?v=guide&id=${encodeURIComponent(target.id)}`);
  };

  return [current, setView];
}
