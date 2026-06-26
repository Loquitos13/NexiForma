"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AcaoCatalogo = {
  id: string;
  codigoInterno: string;
  titulo: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
};

type CursoCatalogo = {
  id: string;
  codigoUfcd: string | null;
  designacao: string;
  cargaHoras: number;
  modalidade: string;
  objetivos: string | null;
  acoesFormacao: AcaoCatalogo[];
};

function estadoVariant(estado: string): "yellow" | "blue" | "green" | "default" {
  if (estado === "PLANEADA") return "yellow";
  if (estado === "EM_CURSO") return "blue";
  if (estado === "CONCLUIDA") return "green";
  return "default";
}

export default function FormandoCatalogoPage() {
  const [cursos, setCursos] = useState<CursoCatalogo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await bffFetch("/api/v1/formando-portal/catalogo", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError("Não foi possível carregar o catálogo.");
      setCursos([]);
      return;
    }
    setCursos((await r.json()) as CursoCatalogo[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">Catálogo formativo</h1>
        <p className="text-sm text-slate-400 mt-1">
          Cursos e acções disponíveis nesta entidade formadora. Para te inscreveres, contacta a
          coordenação ou a tua empresa.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-950/40 border border-red-500/25 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {!cursos ? (
        <p className="text-sm text-slate-500 text-center py-10">A carregar catálogo…</p>
      ) : cursos.length === 0 ? (
        <Card className="border-dashed border-slate-700/50">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            De momento não há formações abertas no catálogo.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cursos.map((curso) => (
            <Card key={curso.id} className="border-slate-700/30 bg-slate-900/40 overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base text-slate-100">{curso.designacao}</CardTitle>
                  {curso.codigoUfcd ? (
                    <Badge variant="blue">UFCD {curso.codigoUfcd}</Badge>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {curso.cargaHoras}h · {curso.modalidade}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {curso.objetivos ? (
                  <p className="text-sm text-slate-400 leading-relaxed">{curso.objetivos}</p>
                ) : null}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Acções abertas
                  </p>
                  {curso.acoesFormacao.map((acao) => (
                    <div
                      key={acao.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/25 bg-slate-800/30 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{acao.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {acao.codigoInterno} ·{" "}
                          {new Date(acao.dataInicio).toLocaleDateString("pt-PT")} –{" "}
                          {new Date(acao.dataFim).toLocaleDateString("pt-PT")}
                        </p>
                      </div>
                      <Badge variant={estadoVariant(acao.estado)}>
                        {acao.estado === "EM_CURSO" ? "Em curso" : "Planeada"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
