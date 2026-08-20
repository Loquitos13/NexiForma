"use client";

import { useModuloMediaBlobUrl } from "@/lib/lms/use-modulo-media-blob";
import { PdfBlobViewer } from "@/components/lms/PdfBlobViewer";

function isOfficeDoc(mimeType: string | null | undefined, fileName: string | null | undefined): boolean {
  if (
    mimeType?.includes("word") ||
    mimeType?.includes("powerpoint") ||
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("msword")
  ) {
    return true;
  }
  return !!fileName && /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(fileName);
}

type ModuloStoredMediaProps = {
  moduloId: string;
  urlOuRef: string;
  tipo: "VIDEO" | "PDF";
  titulo?: string;
  mimeType?: string | null;
  fileName?: string | null;
  variant?: "preview" | "editor" | "full";
  showActions?: boolean;
  onVideoEnded?: () => void;
  onDocumentoVisualizado?: () => void;
};

/** Pré-visualização / reprodução de ficheiros LMS em storage (fetch autenticado → blob URL). */
export function ModuloStoredMedia({
  moduloId,
  urlOuRef,
  tipo,
  titulo,
  mimeType,
  fileName,
  variant = "full",
  showActions = false,
  onVideoEnded,
  onDocumentoVisualizado,
}: ModuloStoredMediaProps) {
  const { blobUrl, loading, error } = useModuloMediaBlobUrl(moduloId, urlOuRef);

  if (loading) {
    return <p className="text-xs text-slate-500">A carregar ficheiro...</p>;
  }
  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }
  if (!blobUrl) {
    return null;
  }

  const office = isOfficeDoc(mimeType, fileName);
  const isImage = mimeType?.startsWith("image/");

  const actions =
    showActions && blobUrl ? (
      <a
        href={blobUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={fileName ?? undefined}
        className="text-blue-400 hover:text-blue-300 inline-block text-xs"
      >
        Abrir ficheiro
      </a>
    ) : null;

  const editorHeight = "min(52vh, 520px)";

  if (tipo === "VIDEO") {
    return (
      <div className="space-y-2">
        <video
          controls
          className={
            variant === "preview"
              ? "w-full rounded-lg max-h-40 bg-black"
              : variant === "editor"
                ? "w-full rounded-lg bg-black"
                : "w-full aspect-video"
          }
          style={variant === "editor" ? { maxHeight: editorHeight } : undefined}
          src={blobUrl}
          onEnded={onVideoEnded}
        >
          O teu browser não suporta vídeo.
        </video>
        {actions}
      </div>
    );
  }

  if (isImage) {
    return (
      <div className={variant === "preview" ? "space-y-2" : "flex justify-center p-4"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={titulo ?? fileName ?? "Documento"}
          className={
            variant === "preview"
              ? "max-h-40 rounded-lg mx-auto"
              : variant === "editor"
                ? "max-w-full rounded-lg mx-auto"
                : "max-w-full max-h-[70vh] rounded-lg"
          }
          style={variant === "editor" ? { maxHeight: editorHeight } : undefined}
          onLoad={onDocumentoVisualizado}
        />
        {actions}
      </div>
    );
  }

  if (office) {
    return (
      <div className="text-center space-y-3 py-2">
        <p className="text-sm text-slate-300">Documento para transferir</p>
        <a
          href={blobUrl}
          download={fileName ?? "documento"}
          onClick={onDocumentoVisualizado}
          className="inline-flex px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white"
        >
          Descarregar ficheiro
        </a>
      </div>
    );
  }

  const docMinHeight =
    variant === "preview" ? "12rem" : variant === "editor" ? editorHeight : "70vh";

  return (
    <div
      className={
        variant === "preview"
          ? "rounded-lg overflow-hidden border border-slate-700/40 bg-white"
          : "rounded-2xl overflow-hidden border border-slate-700/30 bg-white"
      }
      style={{ minHeight: docMinHeight }}
    >
      {variant === "full" && onDocumentoVisualizado ? (
        <PdfBlobViewer
          blobUrl={blobUrl}
          titulo={titulo ?? fileName ?? "Documento"}
          onUltimaPaginaVista={onDocumentoVisualizado}
        />
      ) : (
        <iframe
          src={blobUrl}
          className="w-full"
          style={{ height: docMinHeight }}
          title={titulo ?? fileName ?? "Documento"}
          onLoad={onDocumentoVisualizado}
        />
      )}
      {showActions ? <div className="p-2">{actions}</div> : null}
    </div>
  );
}
