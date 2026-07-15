"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Bell, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, type Column } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

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
  severidade: "critico" | "aviso";
  codigoInterno: string;
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

const scoreColor = (pct: number) =>
  pct >= 85 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";

const COMPLIANCE_COLS: Column<ComplianceResumo["acoes"][0]>[] = [
  {
    key: "codigoInterno",
    header: "Acção",
    cell: (a) => (
      <div>
        <Link href={`/portal/acoes/${a.acaoId}?tab=compliance`} className="font-semibold text-blue-400 hover:text-blue-300">
          {a.codigoInterno}
        </Link>
        <div className="mt-0.5 max-w-[180px] truncate text-xs text-slate-500">{a.titulo}</div>
      </div>
    ),
  },
  {
    key: "scoreObrigatorioPercent",
    header: "Score",
    cell: (a) => (
      <span className={cn("font-bold tabular-nums", scoreColor(a.scoreObrigatorioPercent))}>
        {a.scoreObrigatorioPercent}%
      </span>
    ),
  },
  {
    key: "prontoInspecao",
    header: "Inspecção",
    cell: (a) =>
      a.prontoInspecao ? (
        <Badge variant="green">Pronta</Badge>
      ) : (
        <Badge variant="red">{a.pendenciasObrigatorias} pend.</Badge>
      ),
  },
];

type Props = {
  compliance: ComplianceResumo | null;
  alertas: ComplianceAlerta[];
  alertasCc: FormadorAlertaCc[];
  canManage: boolean;
  notifyBusy: boolean;
  notifyMsg: string | null;
  onDigest: () => void;
};

export function FormacaoOperacionalPanel({
  compliance,
  alertas,
  alertasCc,
  canManage,
  notifyBusy,
  notifyMsg,
  onDigest,
}: Props) {
  const score = compliance?.resumo.mediaScoreObrigatorio ?? 0;
  const criticos = alertas.filter((a) => a.severidade === "critico");
  const avisos = alertas.filter((a) => a.severidade === "aviso");

  if (!compliance && alertas.length === 0 && alertasCc.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Formação e compliance</h2>
        <Link href="/portal/compliance" className="text-xs text-blue-400 hover:text-blue-300">
          Ver compliance →
        </Link>
      </div>

      {(criticos.length > 0 || avisos.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Alertas operacionais
              {criticos.length > 0 ? <Badge variant="red">{criticos.length}</Badge> : null}
            </CardTitle>
            {canManage ? (
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="ghost" disabled={notifyBusy} onClick={onDigest}>
                  <Bell className="h-3.5 w-3.5" /> Digest
                </Button>
                {notifyMsg ? <span className="text-xs text-green-400">{notifyMsg}</span> : null}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {alertas.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg bg-slate-800/40 p-2.5 text-sm">
                <Badge variant={a.severidade === "critico" ? "red" : "yellow"}>
                  {a.severidade === "critico" ? "Crítico" : "Aviso"}
                </Badge>
                <span className="min-w-0 flex-1 text-slate-400">
                  <span className="font-medium text-slate-200">{a.codigoInterno}</span> - {a.mensagem}
                </span>
                <Link href={a.accaoUrl} className="shrink-0 text-xs text-blue-400">
                  Resolver
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {compliance ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              Compliance DGERT
            </CardTitle>
            <p className="text-xs text-slate-500">
              Média: <span className={cn("font-bold", scoreColor(score))}>{score}%</span> ·{" "}
              {compliance.resumo.prontasInspecao}/{compliance.resumo.totalAcoes} prontas
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable columns={COMPLIANCE_COLS} data={compliance.acoes.slice(0, 3)} keyField="acaoId" />
            <Link
              href="/portal/compliance"
              className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              Detalhe completo <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {alertasCc.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">CC / CCP a renovar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {alertasCc.slice(0, 3).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-slate-200">{a.nomeCompleto}</div>
                  <div className="text-xs text-slate-500">
                    {a.tipo.toUpperCase()} · {a.validade}
                  </div>
                </div>
                <Badge variant={a.severidade === "critico" ? "red" : "yellow"}>
                  {a.diasRestantes < 0 ? "Expirado" : `${a.diasRestantes}d`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
