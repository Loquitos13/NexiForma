"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Mail, Phone, UserPlus, FileText } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { fmtEuro, propostaEstadoLabel } from "@/lib/crm/shared";
import type { ClienteFichaData } from "@/components/crm/use-cliente-ficha-data";

type Cliente = {
  id: string;
  nif: string;
  nome: string;
  moradaFiscal: string | null;
  email: string | null;
  telefone: string | null;
  _count?: { propostas: number };
};

const CHART_A11Y_OFF = { accessibilityLayer: false } as const;
const ESTADO_COLORS: Record<string, string> = {
  ACEITE: "#34d399",
  ENVIADA: "#60a5fa",
  RASCUNHO: "#64748b",
  REJEITADA: "#f87171",
  CANCELADA: "#475569",
};

function buildContactSeries(interaccoes: { createdAt: string }[]) {
  if (interaccoes.length === 0) return [];
  const sorted = [...interaccoes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const firstMs = new Date(sorted[0].createdAt).getTime();
  const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
  const buckets = new Map<number, number>();
  for (const item of sorted) {
    const week = Math.floor((new Date(item.createdAt).getTime() - firstMs) / MS_WEEK);
    buckets.set(week, (buckets.get(week) ?? 0) + 1);
  }
  const maxWeek = Math.max(...buckets.keys(), 0);
  let cumulative = 0;
  return Array.from({ length: maxWeek + 1 }, (_, w) => {
    const notas = buckets.get(w) ?? 0;
    cumulative += notas;
    return {
      label: `Sem. ${w + 1}`,
      notas,
      acumulado: cumulative,
    };
  });
}

function buildConversao(propostas: ClienteFichaData["propostas"]) {
  const relevantes = propostas.filter((p) => p.estado !== "CANCELADA");
  const aceites = relevantes.filter((p) => p.estado === "ACEITE").length;
  const total = relevantes.length;
  const taxa = total > 0 ? Math.round((aceites / total) * 100) : 0;

  const estados = ["ACEITE", "ENVIADA", "RASCUNHO", "REJEITADA"] as const;
  const barras = estados
    .map((e) => ({
      name: propostaEstadoLabel(e),
      valor: propostas.filter((p) => p.estado === e).length,
      fill: ESTADO_COLORS[e],
    }))
    .filter((b) => b.valor > 0);

  const pie = [
    { name: "Aceites", value: aceites, fill: ESTADO_COLORS.ACEITE },
    { name: "Outras", value: Math.max(total - aceites, 0), fill: "#475569" },
  ].filter((s) => s.value > 0);

  return { taxa, total, aceites, barras, pie };
}

type Props = {
  cliente: Cliente;
  ficha: ClienteFichaData;
  loading: boolean;
};

export function ClienteFichaDados({ cliente, ficha, loading }: Props) {
  const contactoSeries = useMemo(
    () => buildContactSeries(ficha.interaccoes),
    [ficha.interaccoes],
  );
  const conversao = useMemo(() => buildConversao(ficha.propostas), [ficha.propostas]);

  const primeiroContacto =
    ficha.interaccoes.length > 0
      ? [...ficha.interaccoes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0].createdAt
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <UserPlus className="h-8 w-8 text-indigo-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{ficha.leadsCount}</p>
              <p className="text-xs text-slate-500">Leads comerciais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <FileText className="h-8 w-8 text-violet-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{ficha.propostas.length}</p>
              <p className="text-xs text-slate-500">Propostas comerciais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Morada fiscal</p>
            <p className="text-sm text-slate-300 whitespace-pre-line">
              {cliente.moradaFiscal?.trim() || "- Em falta (obrigatório para faturação)"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Contacto</p>
            {cliente.email ? (
              <p className="text-sm text-slate-300 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                {cliente.email}
              </p>
            ) : null}
            {cliente.telefone ? (
              <p className="text-sm text-slate-300 flex items-center gap-2 mt-1">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                {cliente.telefone}
              </p>
            ) : null}
            {!cliente.email && !cliente.telefone ? (
              <Badge variant="default">Sem contacto registado</Badge>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Taxa de conversão (propostas)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">A carregar…</p>
            ) : conversao.total === 0 ? (
              <p className="text-sm text-slate-500">Sem propostas para calcular conversão.</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart {...CHART_A11Y_OFF}>
                      <Pie
                        data={conversao.pie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={64}
                        paddingAngle={2}
                      >
                        {conversao.pie.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15, 23, 42, 0.95)",
                          border: "1px solid rgba(51, 65, 85, 0.6)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-slate-100">{conversao.taxa}%</span>
                    <span className="text-[10px] text-slate-500">aceites</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-green-400">{conversao.aceites}</span> aceites de{" "}
                    <span className="font-semibold">{conversao.total}</span> propostas activas.
                  </p>
                  {conversao.barras.length > 0 ? (
                    <div className="h-36 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart {...CHART_A11Y_OFF} data={conversao.barras} layout="vertical" margin={{ left: 4, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} width={72} />
                          <Tooltip cursor={false} />
                          <Bar dataKey="valor" name="Propostas" radius={[0, 4, 4, 0]}>
                            {conversao.barras.map((b) => (
                              <Cell key={b.name} fill={b.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contacto activo (notas de reunião)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">A carregar…</p>
            ) : contactoSeries.length === 0 ? (
              <p className="text-sm text-slate-500">
                Sem notas registadas - a frequência aparece aqui quando houver reuniões.
              </p>
            ) : (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  Desde o 1.º contacto ({new Date(primeiroContacto!).toLocaleDateString("pt-PT")}) -{" "}
                  {ficha.interaccoes.length} nota(s) no total.
                </p>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart {...CHART_A11Y_OFF} data={contactoSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15, 23, 42, 0.95)",
                          border: "1px solid rgba(51, 65, 85, 0.6)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="notas"
                        name="Notas na semana"
                        stroke="#a78bfa"
                        strokeWidth={2}
                        dot={{ fill: "#a78bfa", r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="acumulado"
                        name="Total acumulado"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
