"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MatriculaDocumentoConsentModal,
  type DocConsentItem,
} from "@/components/formando/matricula-documento-consent-modal";

type Payload = {
  matriculaId: string;
  acao: { id: string; codigoInterno: string; titulo: string };
  turma: { codigo: string; nome: string };
  documentosCurso: DocConsentItem[];
  documentosUniversais: {
    completo: boolean;
    emFalta: string[];
    items: Array<{ id: string; label: string; completo: boolean }>;
  };
  completo: boolean;
};

export default function FormandoInscricaoDocumentosPage() {
  const params = useParams<{ matriculaId: string }>();
  const matriculaId = params.matriculaId;
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const r = await bffFetch(`/api/v1/formando-portal/inscricoes/${matriculaId}/documentos`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      setError(await parseApiError(r));
      setData(null);
      return;
    }
    setData((await r.json()) as Payload);
  }, [matriculaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendentes = useMemo(
    () => data?.documentosCurso.filter((d) => !d.completo).length ?? 0,
    [data],
  );

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
      <div>
        <Link
          href="/portal/formando/inscricoes"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Inscrições
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Documentos da inscrição</h1>
        {data ? (
          <p className="text-sm text-slate-400 mt-1">
            {data.acao.titulo} · {data.acao.codigoInterno} · {data.turma.codigo}
          </p>
        ) : null}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {!data ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : (
        <>
          <Card>
            <CardHeader className="border-b border-slate-700/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Documentos deste curso</CardTitle>
                <Badge variant={data.documentosCurso.every((d) => d.completo) ? "green" : "yellow"}>
                  {data.documentosCurso.every((d) => d.completo) ? "Completo" : "Incompleto"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                A coordenação publica os PDFs (declaração, contrato, regulamento). Deve lê-los por
                ordem e registar o consentimento de leitura.
              </p>
              {pendentes > 0 ? (
                <Button size="sm" className="mt-3" onClick={() => setConsentOpen(true)}>
                  {pendentes === data.documentosCurso.length
                    ? "Iniciar leitura e consentimento"
                    : `Continuar (${pendentes} em falta)`}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {data.documentosCurso.map((doc, i) => (
                <div
                  key={doc.categoria}
                  className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 tabular-nums">{i + 1}.</span>
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-200">{doc.label}</span>
                      <span className="text-red-400">*</span>
                    </div>
                    {doc.completo ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <Check className="h-3.5 w-3.5" />
                        Aceite
                        {doc.aceiteEm ? ` · ${formatDatePt(doc.aceiteEm)}` : ""}
                      </span>
                    ) : doc.disponivel ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                        <X className="h-3.5 w-3.5" />
                        Pendente
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">Aguarda publicação</span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-slate-700/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Documentos universais (ficha do formando)</CardTitle>
                <Badge variant={data.documentosUniversais.completo ? "green" : "yellow"}>
                  {data.documentosUniversais.completo ? "Completo" : "Em falta"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {data.documentosUniversais.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  {item.completo ? (
                    <span className="text-green-400 text-xs">✓ Enviado</span>
                  ) : (
                    <span className="text-amber-400 text-xs">Pendente</span>
                  )}
                </div>
              ))}
              <Link
                href="/portal/formando/perfil"
                className="inline-flex text-sm text-blue-400 hover:text-blue-300 mt-2"
              >
                Gerir documentos no perfil →
              </Link>
            </CardContent>
          </Card>

          <MatriculaDocumentoConsentModal
            open={consentOpen}
            matriculaId={matriculaId}
            documentos={data.documentosCurso}
            onClose={() => setConsentOpen(false)}
            onAccepted={() => {
              void load();
              if (data.documentosCurso.filter((d) => !d.completo).length <= 1) {
                setConsentOpen(false);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
