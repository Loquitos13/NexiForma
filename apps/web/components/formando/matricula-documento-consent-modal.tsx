"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, FileText } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/ui/cn";

export type DocConsentItem = {
  categoria: string;
  ordem: number;
  label: string;
  estado: string;
  completo: boolean;
  podeAceitar: boolean;
  disponivel: boolean;
  aceiteEm?: string | null;
  documentoLeitura: { id: string; nome: string } | null;
};

type Props = {
  open: boolean;
  matriculaId: string;
  documentos: DocConsentItem[];
  onClose: () => void;
  onAccepted: () => void;
};

export function MatriculaDocumentoConsentModal({
  open,
  matriculaId,
  documentos,
  onClose,
  onAccepted,
}: Props) {
  const pendentes = documentos.filter((d) => !d.completo);
  const actual = pendentes[0] ?? null;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scrollReady, setScrollReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadPdf = useCallback(async (docId: string) => {
    setLoadError(null);
    setScrollReady(false);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    const r = await bffFetch(`/api/v1/formando-portal/documentos/${docId}/download`);
    if (!r.ok) {
      setLoadError(await parseApiError(r));
      return;
    }
    const blob = await r.blob();
    setPdfUrl(URL.createObjectURL(blob));
  }, []);

  useEffect(() => {
    if (!open || !actual?.documentoLeitura?.id) return;
    void loadPdf(actual.documentoLeitura.id);
  }, [open, actual?.categoria, actual?.documentoLeitura?.id, loadPdf]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!open) {
      setScrollReady(false);
      setLoadError(null);
    }
  }, [open]);

  function onScrollArea() {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (nearBottom) setScrollReady(true);
  }

  async function aceitar() {
    if (!actual) return;
    setBusy(true);
    setLoadError(null);
    const r = await bffFetch(
      `/api/v1/formando-portal/inscricoes/${matriculaId}/documentos/${encodeURIComponent(actual.categoria)}/aceitar`,
      { method: "POST" },
    );
    setBusy(false);
    if (!r.ok) {
      setLoadError(await parseApiError(r));
      return;
    }
    onAccepted();
  }

  if (!actual) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <p className="text-sm text-green-400 flex items-center gap-2">
            <Check className="h-4 w-4" />
            Todos os documentos de inscrição foram aceites.
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const idx = documentos.findIndex((d) => d.categoria === actual.categoria);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              Documento {idx + 1} de {documentos.length}
            </p>
            <h2 className="text-lg font-semibold text-slate-50">{actual.label}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Leia o documento na íntegra (deslize até ao fim) e registe o consentimento antes de
              avançar para o seguinte.
            </p>
          </div>
        </div>

        {!actual.disponivel ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            A coordenação pedagógica ainda não publicou este documento. Volte mais tarde.
          </div>
        ) : (
          <div
            ref={scrollRef}
            onScroll={onScrollArea}
            className="min-h-[45vh] max-h-[55vh] overflow-y-auto rounded-lg border border-slate-700/50 bg-slate-950"
          >
            {loadError ? (
              <p className="p-4 text-sm text-red-400">{loadError}</p>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                title={actual.label}
                className="h-[52vh] w-full border-0"
                onLoad={() => {
                  window.setTimeout(() => onScrollArea(), 400);
                }}
              />
            ) : (
              <p className="p-4 text-sm text-slate-500">A carregar documento…</p>
            )}
          </div>
        )}

        {loadError ? null : (
          <p className="text-xs text-slate-500">
            {scrollReady
              ? "Chegou ao fim do documento — pode registar o consentimento."
              : "Deslize o painel até ao fim do PDF para activar o botão de consentimento."}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !actual.podeAceitar ||
              !actual.disponivel ||
              !scrollReady ||
              Boolean(loadError)
            }
            onClick={() => void aceitar()}
            className={cn(!scrollReady && "opacity-60")}
          >
            {busy ? "A registar…" : "Li e aceito"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
