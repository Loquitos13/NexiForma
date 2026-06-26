"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { gridStats, LoadingBlock, PageShell, StatCard } from "@/components/portal/page-shell";
import { bo, parseApiError } from "@/lib/ui/backoffice";

type Relatorio = {
  geradoEm: string;
  formacao: {
    matriculasAtivas: number;
    matriculasConcluidas: number;
    taxaConclusao: number;
    acoesEmCurso: number;
    taxaAprovacaoQuiz: number | null;
  };
  comercial: { propostasAbertas: number; propostasGanhas: number };
  compliance: {
    formadoresCcExpirar30d: number;
    sigoPendentes: number;
    sigoRejeitadas: number;
  };
};

export default function RelatoriosPage() {
  const [data, setData] = useState<Relatorio | null>(null);
  const [inspecao, setInspecao] = useState<{ acoes: unknown[]; submissoes: unknown[]; totalDocumentos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      bffFetch("/api/v1/relatorios/executivo", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/relatorios/inspecao", { headers: { accept: "application/json" } }),
    ]);
    if (!r1.ok) setError(await parseApiError(r1));
    else setData((await r1.json()) as Relatorio);
    if (r2.ok) setInspecao(await r2.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell
      title="Relatórios executivos"
      subtitle="Indicadores para gestão, inspecção DGERT e tomada de decisão."
    >
      {error ? <p style={bo.alert}>{error}</p> : null}
      {loading || !data ? (
        <LoadingBlock />
      ) : (
        <>
          <div style={gridStats()}>
            <StatCard label="Matrículas activas" value={data.formacao.matriculasAtivas} />
            <StatCard label="Taxa conclusão" value={`${data.formacao.taxaConclusao}%`} color={bo.scoreColor(data.formacao.taxaConclusao)} />
            <StatCard label="Acções em curso" value={data.formacao.acoesEmCurso} />
            <StatCard
              label="Aprovação quiz"
              value={data.formacao.taxaAprovacaoQuiz != null ? `${data.formacao.taxaAprovacaoQuiz}%` : "–"}
              color="#0d9488"
            />
          </div>
          <div style={gridStats()}>
            <StatCard label="Propostas abertas" value={data.comercial.propostasAbertas} color="#fbbf24" />
            <StatCard label="Propostas ganhas" value={data.comercial.propostasGanhas} color="#4ade80" />
            <StatCard label="CC a expirar (30d)" value={data.compliance.formadoresCcExpirar30d} color="#f87171" />
            <StatCard label="SIGO pendentes" value={data.compliance.sigoPendentes} />
          </div>

          {inspecao ? (
            <div style={bo.card}>
              <h2 style={bo.h2}>Pacote inspecção (resumo)</h2>
              <p style={{ color: "#94a3b8", fontSize: "0.88rem" }}>
                {inspecao.acoes.length} acções · {inspecao.submissoes.length} submissões SIGO ·{" "}
                {inspecao.totalDocumentos} documentos anexos
              </p>
              <p style={{ color: "#64748b", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                Gerado em {new Date(data.geradoEm).toLocaleString("pt-PT")}
              </p>
            </div>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
