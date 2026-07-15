"use client";

import Link from "next/link";
import {
  BookOpen,
  Calendar,
  GraduationCap,
  TrendingUp,
  Users,
} from "lucide-react";
import { FormacaoOperacionalPanel } from "@/components/dashboard/formacao-operacional-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type Aggregates = {
  cursos?: number;
  acoesPorEstado?: { PLANEADA?: number; EM_CURSO?: number; CONCLUIDA?: number; CANCELADA?: number };
  formandos?: number;
  turmas?: number;
  sessoesAgendadasFuturas?: number;
};

type ComplianceResumo = {
  resumo: { totalAcoes: number; prontasInspecao: number; mediaScoreObrigatorio: number };
  acoes: Array<{
    acaoId: string;
    codigoInterno: string;
    titulo: string;
    scoreObrigatorioPercent: number;
    prontoInspecao: boolean;
    pendenciasObrigatorias: number;
  }>;
};

type ComplianceAlerta = {
  id: string;
  tipo: string;
  severidade: "critico" | "aviso";
  acaoId: string;
  codigoInterno: string;
  titulo: string;
  mensagem: string;
  accaoUrl: string;
};

type FormadorAlertaCc = {
  id: string;
  nomeCompleto: string;
  tipo: string;
  validade: string;
  diasRestantes: number;
  severidade: "critico" | "aviso";
};

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-slate-100",
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-700/40 bg-slate-900/40 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800/80">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div>
        <div className={cn("text-xl font-bold tabular-nums", color)}>{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function DashboardFormacaoResumoPanel({ aggregates }: { aggregates?: Aggregates | null }) {
  if (!aggregates) {
    return <p className="text-sm text-slate-500">Sem dados de formação.</p>;
  }

  return (
    <Card className="h-full border-slate-700/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Formação - resumo rápido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard icon={BookOpen} label="Cursos" value={aggregates.cursos ?? 0} color="text-blue-400" />
          <StatCard
            icon={GraduationCap}
            label="Em curso"
            value={aggregates.acoesPorEstado?.EM_CURSO ?? 0}
            color="text-green-400"
          />
          <StatCard
            icon={TrendingUp}
            label="Planeadas"
            value={aggregates.acoesPorEstado?.PLANEADA ?? 0}
            color="text-yellow-400"
          />
          <StatCard icon={Users} label="Formandos" value={aggregates.formandos ?? 0} />
          <StatCard icon={BookOpen} label="Turmas" value={aggregates.turmas ?? 0} />
          <StatCard
            icon={Calendar}
            label="Sessões futuras"
            value={aggregates.sessoesAgendadasFuturas ?? 0}
            color="text-purple-400"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardFormacaoOperacionalPanel({
  compliance,
  alertas,
  alertasCc,
  notifyBusy,
  notifyMsg,
  onDigest,
}: {
  compliance: ComplianceResumo | null;
  alertas: ComplianceAlerta[];
  alertasCc: FormadorAlertaCc[];
  notifyBusy: boolean;
  notifyMsg: string | null;
  onDigest: () => void;
}) {
  return (
    <FormacaoOperacionalPanel
      compliance={compliance}
      alertas={alertas}
      alertasCc={alertasCc}
      canManage
      notifyBusy={notifyBusy}
      notifyMsg={notifyMsg}
      onDigest={onDigest}
    />
  );
}

const ATALHOS = [
  { href: "/portal/relatorios", label: "Relatórios" },
  { href: "/portal/crm", label: "CRM" },
  { href: "/portal/propostas", label: "Propostas" },
  { href: "/portal/crm/faturacao", label: "Faturação" },
  { href: "/portal/acoes", label: "Acções" },
  { href: "/portal/compliance", label: "Compliance" },
  { href: "/portal/dossie", label: "Dossiê" },
  { href: "/portal/utilizadores", label: "Equipa" },
];

export function DashboardAtalhosPanel() {
  return (
    <Card className="h-full border-slate-700/40">
      <CardHeader>
        <CardTitle className="text-sm">Atalhos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 pt-0">
        {ATALHOS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-slate-700/50 px-3 py-2 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
          >
            {item.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export type DashboardPortalContext = {
  aggregates?: Aggregates | null;
  compliance: ComplianceResumo | null;
  alertas: ComplianceAlerta[];
  alertasCc: FormadorAlertaCc[];
  notifyBusy: boolean;
  notifyMsg: string | null;
  onDigest: () => void;
};
