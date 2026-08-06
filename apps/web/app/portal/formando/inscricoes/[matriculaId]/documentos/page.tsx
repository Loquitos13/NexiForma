"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, FileText, Upload, X } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DocCurso = {
  categoria: string;
  label: string;
  estado: string;
  completo: boolean;
  aceiteEm: string | null;
  documento: { id: string; nome: string; createdAt: string } | null;
  template: { id: string; nome: string; createdAt: string } | null;
  aceitarSemFicheiro: boolean;
};

type Payload = {
  matriculaId: string;
  acao: { id: string; codigoInterno: string; titulo: string };
  turma: { codigo: string; nome: string };
  documentosCurso: DocCurso[];
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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  async function downloadDoc(docId: string) {
    const r = await bffFetch(`/api/v1/formando-portal/documentos/${docId}/download`);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function upload(categoria: string, file: File) {
    setBusy(categoria);
    setError(null);
    setMsg(null);
    const form = new FormData();
    form.append("file", file);
    const r = await bffFetch(
      `/api/v1/formando-portal/inscricoes/${matriculaId}/documentos?categoria=${encodeURIComponent(categoria)}`,
      { method: "POST", body: form },
    );
    setBusy(null);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Documento enviado.");
    await load();
  }

  async function aceitar(categoria: string) {
    setBusy(categoria);
    setError(null);
    setMsg(null);
    const r = await bffFetch(
      `/api/v1/formando-portal/inscricoes/${matriculaId}/documentos/${encodeURIComponent(categoria)}/aceitar`,
      { method: "POST" },
    );
    setBusy(null);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Regulamento aceite.");
    await load();
  }

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
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {!data ? (
        <p className="text-sm text-slate-500">A carregar…</p>
      ) : (
        <>
          <Card>
            <CardHeader className="border-b border-slate-700/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Documentos deste curso</CardTitle>
                <Badge variant={data.documentosCurso.every((d) => d.completo) ? "green" : "yellow"}>
                  {data.documentosCurso.every((d) => d.completo) ? "Completo" : "Incompleto"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Declaração, contrato e regulamento são específicos desta acção (como na Training House).
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {data.documentosCurso.map((doc) => (
                <div
                  key={doc.categoria}
                  className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium text-slate-200">{doc.label}</span>
                      <span className="text-red-400">*</span>
                    </div>
                    {doc.completo ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <Check className="h-3.5 w-3.5" />
                        {doc.estado === "aceite" ? "Aceite" : "Enviado"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                        <X className="h-3.5 w-3.5" />
                        Pendente
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {doc.template ? (
                      <Button size="sm" variant="secondary" onClick={() => void downloadDoc(doc.template!.id)}>
                        Descarregar modelo
                      </Button>
                    ) : (
                      <span className="text-[11px] text-slate-600 self-center">
                        Modelo ainda não disponível - a coordenação irá carregar.
                      </span>
                    )}
                    {doc.documento ? (
                      <Button size="sm" variant="secondary" onClick={() => void downloadDoc(doc.documento!.id)}>
                        Ver enviado ({formatDatePt(doc.documento.createdAt)})
                      </Button>
                    ) : null}
                    {doc.aceitarSemFicheiro ? (
                      <Button
                        size="sm"
                        disabled={doc.completo || busy === doc.categoria}
                        onClick={() => void aceitar(doc.categoria)}
                      >
                        {busy === doc.categoria ? "A aceitar…" : "Li e aceito o regulamento"}
                      </Button>
                    ) : (
                      <label className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {busy === doc.categoria ? "A enviar…" : doc.documento ? "Substituir" : "Enviar ficheiro"}
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          className="sr-only"
                          disabled={busy === doc.categoria}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void upload(doc.categoria, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
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
              <p className="text-xs text-slate-500 mt-1">
                CV, identificação, habilitações e certidão de grau ficam na tua ficha e servem todos os cursos.
              </p>
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
        </>
      )}
    </div>
  );
}
