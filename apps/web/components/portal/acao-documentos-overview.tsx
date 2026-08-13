"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, FileText, GraduationCap, Users } from "lucide-react";
import { AcaoDocumentosConfig } from "@/components/portal/acao-documentos-config";
import { DocumentosPoliticaSettings } from "@/components/settings/documentos-politica-settings";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

type DocsResumo = {
  formandos: Array<{
    matriculaId: string;
    estado: string;
    turma: { codigo: string; nome: string };
    formando: {
      id: string;
      nome: string;
      nif: string;
      consentimentoRgpd: boolean;
      consentimentoEm: string | null;
    };
    documentosAcao: Array<{
      categoria: string;
      label: string;
      estado: string;
      aceiteEm: string | null;
      temFicheiro: boolean;
    }>;
    documentosPessoais: Array<{
      id: string;
      label: string;
      completo: boolean;
      detalhe: string;
    }>;
  }>;
  formadores: Array<{
    id: string;
    nomeCompleto: string;
    nif: string;
    consentimentoRgpd: boolean;
    consentimentoEm: string | null;
    documentosPessoais: Array<{
      id: string;
      label: string;
      completo: boolean;
      detalhe: string;
    }>;
    documentosAcao: Array<{
      categoria: string;
      label: string;
      templateDisponivel: boolean;
    }>;
  }>;
};

type Props = {
  acaoId: string;
  cargaHoras?: number;
  initial?: unknown;
  onSaved?: (cfg: unknown) => void;
  /** Política documental global do tenant (antes nas configurações). */
  showPoliticaTenant?: boolean;
};

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden />
  ) : (
    <Circle className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden />
  );
}

export function AcaoDocumentosOverview({
  acaoId,
  cargaHoras,
  initial,
  onSaved,
  showPoliticaTenant = false,
}: Props) {
  const [resumo, setResumo] = useState<DocsResumo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await bffFetch(`/api/v1/acoes-formacao/${acaoId}/documentos-resumo`, {
      headers: { accept: "application/json" },
    });
    setLoading(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      setResumo(null);
      return;
    }
    setResumo((await r.json()) as DocsResumo);
  }, [acaoId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-400" />
            Documentos obrigatórios da acção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AcaoDocumentosConfig
            acaoId={acaoId}
            cargaHoras={cargaHoras}
            initial={initial}
            onSaved={(cfg) => {
              onSaved?.(cfg);
              void load();
            }}
          />
        </CardContent>
      </Card>

      {showPoliticaTenant ? (
        <DocumentosPoliticaSettings variant="acao" />
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading && !resumo ? (
        <p className="text-sm text-slate-500">A carregar documentos dos participantes…</p>
      ) : null}

      {resumo ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" />
                Formandos ({resumo.formandos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resumo.formandos.length === 0 ? (
                <p className="text-sm text-slate-500">Sem formandos inscritos.</p>
              ) : (
                resumo.formandos.map((f) => (
                  <div
                    key={f.matriculaId}
                    className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{f.formando.nome}</p>
                        <p className="text-xs text-slate-500">
                          {f.turma.codigo} · NIF {f.formando.nif}
                        </p>
                      </div>
                      <Badge variant={f.formando.consentimentoRgpd ? "green" : "yellow"}>
                        {f.formando.consentimentoRgpd
                          ? "Consentimento OK"
                          : "Sem consentimento"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Obrigatórios da acção
                      </p>
                      <ul className="space-y-1">
                        {f.documentosAcao.map((d) => (
                          <li
                            key={d.categoria}
                            className="flex items-center gap-2 text-xs text-slate-300"
                          >
                            <StatusDot ok={d.estado === "aceite" || Boolean(d.aceiteEm)} />
                            <span className="flex-1">{d.label}</span>
                            <span className="text-slate-500">{d.estado}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Documentos pessoais
                      </p>
                      <ul className="space-y-1">
                        {f.documentosPessoais.map((d) => (
                          <li
                            key={d.id}
                            className={cn(
                              "flex items-center gap-2 text-xs",
                              d.completo ? "text-slate-300" : "text-amber-200/90",
                            )}
                          >
                            <StatusDot ok={d.completo} />
                            <span className="flex-1">{d.label}</span>
                            <span className="text-slate-500">{d.detalhe}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-violet-400" />
                Formadores ({resumo.formadores.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {resumo.formadores.length === 0 ? (
                <p className="text-sm text-slate-500">Sem formadores atribuídos a sessões.</p>
              ) : (
                resumo.formadores.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{f.nomeCompleto}</p>
                        <p className="text-xs text-slate-500">NIF {f.nif}</p>
                      </div>
                      <Badge variant={f.consentimentoRgpd ? "green" : "yellow"}>
                        {f.consentimentoRgpd ? "Consentimento OK" : "Sem consentimento"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Templates da acção (com consentimento)
                      </p>
                      <ul className="space-y-1">
                        {f.documentosAcao.map((d) => (
                          <li
                            key={d.categoria}
                            className="flex items-center gap-2 text-xs text-slate-300"
                          >
                            <StatusDot ok={d.templateDisponivel && f.consentimentoRgpd} />
                            <span className="flex-1">{d.label}</span>
                            <span className="text-slate-500">
                              {d.templateDisponivel ? "template OK" : "sem template"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                        Documentos pessoais
                      </p>
                      <ul className="space-y-1">
                        {f.documentosPessoais.map((d) => (
                          <li
                            key={d.id}
                            className={cn(
                              "flex items-center gap-2 text-xs",
                              d.completo ? "text-slate-300" : "text-amber-200/90",
                            )}
                          >
                            <StatusDot ok={d.completo} />
                            <span className="flex-1">{d.label}</span>
                            <span className="text-slate-500">{d.detalhe}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
