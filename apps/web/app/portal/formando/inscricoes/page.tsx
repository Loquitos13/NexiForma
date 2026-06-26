"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Inscricao = {
  matriculaId: string;
  estado: string;
  inscritoEm: string;
  turma: string;
  acao: string;
  acaoCodigo: string;
  acaoEstado: string;
  dataInicio: string;
  dataFim: string;
  curso: {
    id: string;
    designacao: string;
    codigoUfcd: string | null;
    cargaHoras: number;
    modalidade: string;
  };
};

function matriculaBadge(estado: string) {
  const map: Record<string, { variant: "green" | "yellow" | "red" | "blue" | "default"; label: string }> = {
    ATIVA: { variant: "green", label: "Activa" },
    DESISTENCIA: { variant: "yellow", label: "Desistência" },
    CONCLUSAO: { variant: "blue", label: "Concluída" },
  };
  const e = map[estado] ?? { variant: "default", label: estado };
  return <Badge variant={e.variant}>{e.label}</Badge>;
}

export default function FormandoInscricoesPage() {
  const [items, setItems] = useState<Inscricao[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await bffFetch("/api/v1/formando-portal/inscricoes", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError("Não foi possível carregar as inscrições.");
      setItems([]);
      return;
    }
    setItems((await r.json()) as Inscricao[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">As minhas inscrições</h1>
        <p className="text-sm text-slate-400 mt-1">
          Acções de formação em que estás matriculado. Abre a aprendizagem para sessões e conteúdos.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-500 text-center py-10">A carregar inscrições…</p>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-slate-700/50">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-500">Ainda não tens inscrições activas.</p>
            <Link
              href="/portal/formando/catalogo"
              className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
            >
              Ver catálogo disponível
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.matriculaId}
              className="border-slate-700/30 bg-slate-900/40 hover:border-slate-600/40 transition-colors"
            >
              <CardContent className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-base font-semibold text-slate-100">{item.acao}</h2>
                      {matriculaBadge(item.estado)}
                    </div>
                    <p className="text-sm text-slate-400">{item.curso.designacao}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.acaoCodigo} · {item.turma}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {new Date(item.dataInicio).toLocaleDateString("pt-PT")} –{" "}
                      {new Date(item.dataFim).toLocaleDateString("pt-PT")}
                      {" · "}
                      Inscrito em {new Date(item.inscritoEm).toLocaleDateString("pt-PT")}
                    </p>
                    {item.curso.codigoUfcd ? (
                      <p className="text-[11px] text-slate-600 mt-1">
                        UFCD {item.curso.codigoUfcd} · {item.curso.cargaHoras}h · {item.curso.modalidade}
                      </p>
                    ) : null}
                  </div>
                  {item.estado === "ATIVA" ? (
                    <Link
                      href={`/portal/formando/aprendizagem/${item.matriculaId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shrink-0"
                    >
                      Aprendizagem
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
