"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Bell, Clock, CheckCircle, XCircle } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, PageHeader, type Column } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type AcaoCompliance = {
  acaoId: string; codigoInterno: string; titulo: string; estado: string;
  scorePercent: number; scoreObrigatorioPercent: number;
  prontoInspecao: boolean; pendenciasObrigatorias: number;
};

type ComplianceResumo = {
  resumo: { totalAcoes: number; prontasInspecao: number; mediaScoreObrigatorio: number };
  acoes: AcaoCompliance[];
};

const scoreColor = (pct: number) =>
  pct >= 85 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";

const scoreBarColor = (pct: number) =>
  pct >= 85 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-slate-700">
        <div className={cn("h-full rounded-full transition-all", scoreBarColor(value))} style={{ width: `${value}%` }} />
      </div>
      <span className={cn("text-sm font-bold tabular-nums", scoreColor(value))}>{value}%</span>
    </div>
  );
}

const COLUMNS: Column<AcaoCompliance>[] = [
  {
    key: "codigoInterno", header: "Acção",
    cell: (a) => (
      <div>
        <Link href={`/portal/acoes/${a.acaoId}?tab=compliance`} className="font-semibold text-blue-400 hover:text-blue-300">{a.codigoInterno}</Link>
        <div className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{a.titulo}</div>
      </div>
    ),
  },
  {
    key: "estado", header: "Estado",
    cell: (a) => <Badge variant="default">{a.estado}</Badge>,
  },
  {
    key: "scorePercent", header: "Score total",
    cell: (a) => <ScoreBar value={a.scorePercent} />,
  },
  {
    key: "scoreObrigatorioPercent", header: "Obrigatórios",
    cell: (a) => <ScoreBar value={a.scoreObrigatorioPercent} />,
  },
  {
    key: "prontoInspecao", header: "Inspecção",
    cell: (a) => a.prontoInspecao
      ? <span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle className="h-4 w-4" />Pronta</span>
      : <span className="flex items-center gap-1 text-red-400 text-sm"><XCircle className="h-4 w-4" />{a.pendenciasObrigatorias} pend.</span>,
  },
];

export default function CompliancePage() {
  const [data, setData] = useState<ComplianceResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch("/api/v1/compliance/resumo", { headers: { accept: "application/json" } });
    if (!res.ok) setError(await parseApiError(res));
    else setData((await res.json()) as ComplianceResumo);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function enviarDigest() {
    setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch("/api/v1/notificacoes/alertas/digest", { method: "POST", headers: { accept: "application/json" } });
    setBusy(false);
    if (!res.ok) { setError(await parseApiError(res)); return; }
    const r = (await res.json()) as { enviados: number; alertas: number };
    setMsg(`Digest enviado a ${r.enviados} destinatário(s) (${r.alertas} alerta(s)).`);
  }

  async function enviarLembretes() {
    setBusy(true); setError(null); setMsg(null);
    const res = await bffFetch("/api/v1/notificacoes/sessoes/lembretes", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!res.ok) { setError(await parseApiError(res)); return; }
    const r = (await res.json()) as { sessoes: number; emailsEnviados: number };
    setMsg(r.emailsEnviados > 0 ? `${r.emailsEnviados} lembretes enviados para ${r.sessoes} sessão(ões) amanhã.` : "Sem sessões amanhã.");
  }

  const r = data?.resumo;

  return (
    <>
      <PageHeader
        title="Compliance DGERT"
        description="Checklist de 19 critérios – obrigatórios para inspecção e recomendados para excelência operacional."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void enviarLembretes()}>
              <Clock className="h-3.5 w-3.5" />Lembretes sessão
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void enviarDigest()}>
              <Bell className="h-3.5 w-3.5" />Digest alertas
            </Button>
          </div>
        }
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}

      {/* Score cards */}
      {r && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card className="text-center p-5">
            <div className={cn("text-3xl font-black", scoreColor(r.mediaScoreObrigatorio))}>{r.mediaScoreObrigatorio}%</div>
            <div className="mt-1 text-xs text-slate-500">Média obrigatórios</div>
          </Card>
          <Card className="text-center p-5">
            <div className="text-3xl font-black text-slate-100">{r.totalAcoes}</div>
            <div className="mt-1 text-xs text-slate-500">Acções avaliadas</div>
          </Card>
          <Card className="text-center p-5">
            <div className="text-3xl font-black text-green-400">{r.prontasInspecao}</div>
            <div className="mt-1 text-xs text-slate-500">Prontas para inspecção</div>
          </Card>
        </div>
      )}

      <DataTable
        columns={COLUMNS}
        data={data?.acoes ?? []}
        keyField="acaoId"
        loading={loading}
        emptyMessage="Sem acções de formação avaliadas."
      />

      {/* Grupos do checklist */}
      <Card className="mt-6">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-400" />Grupos do checklist DGERT</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Catálogo", desc: "UFCD, objectivos, carga horária", icon: "📚" },
              { label: "Planeamento", desc: "Cronograma, aprovação, sessões, horas", icon: "📅" },
              { label: "Equipa", desc: "Formadores atribuídos, CC/CCP válidos", icon: "👥" },
              { label: "Participantes", desc: "Matrículas activas, NIF válidos", icon: "🎓" },
              { label: "Execução", desc: "Sumários assinados, folhas fechadas, assiduidade", icon: "✅" },
              { label: "Entidade", desc: "NIF da entidade formadora", icon: "🏢" },
            ].map((g) => (
              <div key={g.label} className="rounded-lg border border-slate-700/40 p-3">
                <div className="mb-1 text-base">{g.icon} <span className="font-semibold text-slate-200 text-sm">{g.label}</span></div>
                <p className="text-xs text-slate-500">{g.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
