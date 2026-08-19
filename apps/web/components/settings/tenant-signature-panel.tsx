"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Trash2, Upload } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import {
  isAcceptedSignatureImageFile,
  processSignatureImageFileDetailed,
  type SignatureProcessOptions,
} from "@/lib/client/signature-image.util";
import { Button } from "@/components/ui";

type BrandingSignature = {
  signatureUrl?: string;
  signatureResponsibleName?: string;
};

type ImportMode = "upload" | "camera";

export function TenantSignaturePanel() {
  const [branding, setBranding] = useState<BrandingSignature | null>(null);
  const [responsibleName, setResponsibleName] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("upload");
  const [threshold, setThreshold] = useState<number | null>(null);
  const [contrast, setContrast] = useState<number | null>(null);
  const [autoThreshold, setAutoThreshold] = useState<number | null>(null);
  const [alreadyTransparent, setAlreadyTransparent] = useState(false);
  const [showFineTune, setShowFineTune] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await bffFetch("/api/v1/portal/tenant/branding", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return;
    const data = (await r.json()) as BrandingSignature;
    setBranding(data);
    setResponsibleName(data.signatureResponsibleName ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      setAlreadyTransparent(false);
      return;
    }
    let cancelled = false;
    const opts: SignatureProcessOptions = {};
    if (showFineTune) {
      if (threshold != null) opts.threshold = threshold;
      if (contrast != null) opts.contrast = contrast;
    }
    void processSignatureImageFileDetailed(pendingFile, opts).then((result) => {
      if (cancelled) return;
      if (!showFineTune || threshold == null) {
        setAutoThreshold(result.autoThreshold);
        setAlreadyTransparent(Boolean(result.alreadyTransparent));
      }
      const url = URL.createObjectURL(result.blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pendingFile, threshold, contrast, showFineTune]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function onPickFile(file: File | undefined) {
    if (!file) return;
    if (!isAcceptedSignatureImageFile(file)) {
      setErr("Formato não suportado. Use PNG, JPEG ou WebP.");
      return;
    }
    setPendingFile(file);
    setPendingFileName(file.name);
    setThreshold(null);
    setContrast(null);
    setShowFineTune(false);
    setErr(null);
    setMsg(null);
  }

  function onDropFiles(files: FileList | null | undefined) {
    setDragOver(false);
    onPickFile(files?.[0]);
  }

  async function saveSignature() {
    if (!pendingFile) {
      setErr(
        importMode === "camera"
          ? "Fotografe a assinatura primeiro."
          : "Importe uma imagem da assinatura primeiro.",
      );
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const opts: SignatureProcessOptions = {};
      if (showFineTune) {
        if (threshold != null) opts.threshold = threshold;
        if (contrast != null) opts.contrast = contrast;
      }
      const { blob } = await processSignatureImageFileDetailed(pendingFile, opts);
      const fd = new FormData();
      fd.append("file", blob, "assinatura.png");
      fd.append("responsibleName", responsibleName.trim());
      const r = await bffFetch("/api/v1/portal/tenant/signature", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        setErr("Não foi possível guardar a assinatura.");
        return;
      }
      setPendingFile(null);
      setPendingFileName(null);
      setCacheBust(Date.now());
      setMsg("Assinatura guardada.");
      await load();
    } catch {
      setErr("Erro ao processar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNameOnly() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/portal/tenant/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({ signatureResponsibleName: responsibleName.trim() }),
    });
    setBusy(false);
    if (!r.ok) {
      setErr("Não foi possível guardar o nome.");
      return;
    }
    setMsg("Nome do responsável actualizado.");
    await load();
  }

  async function removeSignature() {
    if (!window.confirm("Remover a assinatura guardada?")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await bffFetch("/api/v1/portal/tenant/signature", { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      setErr("Não foi possível remover a assinatura.");
      return;
    }
    setPendingFile(null);
    setPendingFileName(null);
    setCacheBust(Date.now());
    setMsg("Assinatura removida.");
    await load();
  }

  const storedUrl = branding?.signatureUrl
    ? `${branding.signatureUrl}?v=${cacheBust}`
    : null;
  const displayUrl = previewUrl ?? storedUrl;

  return (
    <section className="rounded-2xl border border-slate-700/30 bg-slate-900/50 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Assinatura do responsável</h2>
        <p className="text-xs text-slate-500 mt-1">
          Importe uma imagem ou fotografe a assinatura num papel claro. O fundo é removido
          automaticamente. Para máxima qualidade, prepare o PNG noutra app (ex. PhotoRoom) e
          importe-o - ficheiros já transparentes não são reprocessados. Use{" "}
          <code className="text-slate-400">{`{{entidade.assinatura}}`}</code> e{" "}
          <code className="text-slate-400">{`{{entidade.responsavel_assinatura}}`}</code> nos
          templates.
        </p>
      </div>

      {err ? <p className="text-xs text-red-300">{err}</p> : null}
      {msg ? <p className="text-xs text-green-300">{msg}</p> : null}

      <label className="block space-y-1 max-w-md">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Nome do responsável
        </span>
        <input
          type="text"
          value={responsibleName}
          onChange={(e) => setResponsibleName(e.target.value)}
          placeholder="Ex.: Dr. Ana Costa - Directora"
          className="w-full rounded-lg border border-slate-600/60 bg-slate-950 px-3 py-2 text-xs text-slate-200"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={importMode === "upload" ? "default" : "secondary"}
          disabled={busy}
          onClick={() => setImportMode("upload")}
        >
          <ImageUp className="mr-1.5 h-3.5 w-3.5" />
          Importar imagem
        </Button>
        <Button
          type="button"
          size="sm"
          variant={importMode === "camera" ? "default" : "secondary"}
          disabled={busy}
          onClick={() => setImportMode("camera")}
        >
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          Fotografar
        </Button>
        {branding?.signatureUrl ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void removeSignature()}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remover
          </Button>
        ) : null}
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {importMode === "upload" ? (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") uploadRef.current?.click();
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            onDropFiles(e.dataTransfer.files);
          }}
          onClick={() => uploadRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-400/70 bg-blue-950/30"
              : "border-slate-600/50 bg-slate-950/40 hover:border-slate-500/70"
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-slate-500 mb-2" />
          <p className="text-sm text-slate-200 font-medium">
            Arraste uma imagem para aqui ou clique para seleccionar
          </p>
          <p className="text-xs text-slate-500 mt-1">PNG, JPEG ou WebP - scan, foto ou PNG já transparente</p>
          {pendingFileName ? (
            <p className="text-xs text-blue-300 mt-2 truncate max-w-full">{pendingFileName}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-slate-950/40 p-6 text-center space-y-3">
          <Camera className="mx-auto h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-200">
            Use a câmara do telemóvel ou webcam para capturar a assinatura num papel branco.
          </p>
          <Button type="button" size="sm" disabled={busy} onClick={() => cameraRef.current?.click()}>
            Abrir câmara
          </Button>
          {pendingFileName ? (
            <p className="text-xs text-blue-300 truncate max-w-full">Captura: {pendingFileName}</p>
          ) : null}
        </div>
      )}

      {pendingFile && alreadyTransparent ? (
        <p className="text-xs text-slate-400">
          Imagem importada já tinha fundo transparente - aplicado apenas recorte. Ajuste fino não
          é necessário.
        </p>
      ) : null}
      {pendingFile && autoThreshold != null && autoThreshold >= 0 && !showFineTune ? (
        <p className="text-xs text-slate-400">
          Fundo removido automaticamente (limiar estimado: {autoThreshold}). Se a assinatura ficar
          fraca ou com restos de papel, abra o ajuste fino abaixo.
        </p>
      ) : null}

      {pendingFile && !alreadyTransparent ? (
        <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 p-3 space-y-3">
          <button
            type="button"
            className="text-[10px] font-medium uppercase tracking-wide text-slate-400 hover:text-slate-200"
            onClick={() => {
              setShowFineTune((v) => {
                const next = !v;
                if (next) {
                  if (threshold == null) {
                    setThreshold(autoThreshold != null && autoThreshold >= 0 ? autoThreshold : 210);
                  }
                  if (contrast == null) setContrast(1.05);
                }
                return next;
              });
            }}
          >
            {showFineTune ? "▾ Ocultar ajuste fino" : "▸ Ajuste fino (limiar e contraste)"}
          </button>
          {showFineTune ? (
            <div className="grid gap-3 sm:grid-cols-2 max-w-lg">
              <label className="block space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Remoção de fundo - limiar {threshold ?? autoThreshold ?? 210}
                </span>
                <input
                  type="range"
                  min={140}
                  max={250}
                  value={threshold ?? (autoThreshold != null && autoThreshold >= 0 ? autoThreshold : 210)}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <span className="text-[10px] text-slate-600">Mais baixo = mais tinta; mais alto = mais fundo removido</span>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Contraste da tinta - {(contrast ?? 1.05).toFixed(2)}
                </span>
                <input
                  type="range"
                  min={100}
                  max={135}
                  value={Math.round((contrast ?? 1.05) * 100)}
                  onChange={(e) => setContrast(Number(e.target.value) / 100)}
                  className="w-full accent-blue-500"
                />
                <span className="text-[10px] text-slate-600">Aumente se a assinatura ficar demasiado clara</span>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="rounded-xl border border-slate-700/40 p-4 min-h-[120px] flex flex-col items-center justify-center gap-2"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #334155 25%, transparent 25%), linear-gradient(-45deg, #334155 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #334155 75%), linear-gradient(-45deg, transparent 75%, #334155 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          backgroundColor: "#1e293b",
        }}
      >
        {displayUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayUrl} alt="Pré-visualização da assinatura" className="max-h-32 max-w-sm object-contain" />
            {responsibleName.trim() ? (
              <p className="text-xs text-slate-200 border-t border-slate-500/60 pt-1 px-4 text-center">
                {responsibleName.trim()}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-slate-500">Sem assinatura configurada.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !pendingFile} onClick={() => void saveSignature()}>
          Guardar assinatura
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => void saveNameOnly()}
        >
          Guardar só o nome
        </Button>
      </div>
    </section>
  );
}
