"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PdfBlobViewerProps = {
  blobUrl: string;
  titulo?: string;
  /** Chamado quando o formando visualiza a última página. */
  onUltimaPaginaVista?: () => void;
};

/** Viewer PDF com detecção de última página (substitui iframe opaco do browser). */
export function PdfBlobViewer({ blobUrl, titulo, onUltimaPaginaVista }: PdfBlobViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const ultimaPaginaReportada = useRef(false);

  useEffect(() => {
    let cancelled = false;
    ultimaPaginaReportada.current = false;
    setLoading(true);
    setError(null);
    setPage(1);
    setNumPages(0);
    pdfRef.current = null;

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const doc = await pdfjs.getDocument(blobUrl).promise;
        if (cancelled) return;
        pdfRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Não foi possível abrir o PDF.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [blobUrl]);

  const reportarUltimaPagina = useCallback(() => {
    if (ultimaPaginaReportada.current) return;
    ultimaPaginaReportada.current = true;
    onUltimaPaginaVista?.();
  }, [onUltimaPaginaVista]);

  useEffect(() => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading) return;

    let cancelled = false;
    void (async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
        if (!cancelled && page === doc.numPages) reportarUltimaPagina();
      } catch {
        if (!cancelled) setError("Erro ao renderizar página.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, scale, loading, reportarUltimaPagina]);

  if (loading) {
    return <p className="text-sm text-slate-500 p-6 text-center">A carregar PDF…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-400 p-6 text-center">{error}</p>;
  }

  return (
    <div className="flex flex-col bg-slate-100 min-h-[70vh]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-800 border-b border-slate-700/40">
        <span className="text-xs text-slate-300 truncate max-w-[40%]">{titulo ?? "Documento"}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-30"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-slate-300 tabular-nums min-w-[4rem] text-center">
            {page} / {numPages}
          </span>
          <button
            type="button"
            disabled={page >= numPages}
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-700 disabled:opacity-30"
            aria-label="Página seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="text-xs bg-slate-700 text-slate-200 rounded-lg px-2 py-1 border-0"
          >
            <option value={0.8}>80%</option>
            <option value={1.1}>110%</option>
            <option value={1.4}>140%</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <canvas ref={canvasRef} className="shadow-lg max-w-full" />
      </div>
      {page === numPages ? (
        <p className="text-[11px] text-center text-slate-500 py-2 border-t border-slate-200">
          Última página - a conclusão regista-se automaticamente.
        </p>
      ) : null}
    </div>
  );
}
