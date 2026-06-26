"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  Loader2,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DOC_ACCEPT_MIMES,
  validarImagemDocumento,
  type ValidacaoDocumento,
} from "@/lib/formando/document-image-validation";
import {
  DOCUMENTO_LAYOUTS,
  ID1_ASPECT,
  type LayoutDocumento,
  type LadoDocumento,
  type PassoCaptura,
  type TipoDocumento,
} from "@/lib/formando/document-layouts";
import { useMobileDevice } from "@/lib/formando/use-mobile-device";

type Props = {
  tipo: TipoDocumento;
  disabled?: boolean;
  ladosEnviados?: LadoDocumento[];
  onCapture: (file: File, lado: LadoDocumento) => void;
};

const ACCEPT_IMAGE = DOC_ACCEPT_MIMES.join(",");

type CaptureMethod = "camera" | "upload";

function IconCamera({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="4" y="12" width="40" height="28" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="24" cy="26" r="8" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="24" cy="26" r="3" fill="currentColor" />
      <path d="M16 12L20 6h8l4 6" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconUploadPhoto({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="17" cy="19" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 32l10-9 8 7 6-5 12 11"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M30 6v8M26 10h8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CaptureMethodChoice({
  lado,
  isMobile,
  disabled,
  onChooseCamera,
  onChooseUpload,
}: {
  lado: LadoDocumento;
  isMobile: boolean;
  disabled?: boolean;
  onChooseCamera: () => void;
  onChooseUpload: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-medium text-slate-300">
        Como queres registar a {ladoLabel(lado)}?
      </p>
      <div className={`grid gap-3 ${isMobile ? "sm:grid-cols-2" : "grid-cols-1 max-w-xs mx-auto"}`}>
        {isMobile ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onChooseCamera}
            className="group flex flex-col items-center gap-3 rounded-xl border border-teal-500/30 bg-teal-950/20 p-5 text-left transition-colors hover:border-teal-400/50 hover:bg-teal-950/35 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 transition-colors group-hover:bg-teal-500/25">
              <IconCamera className="h-9 w-9" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-100">Fotografar</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Câmara traseira com moldura de alinhamento
              </span>
            </span>
          </button>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={onChooseUpload}
          className="group flex flex-col items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-950/20 p-5 text-left transition-colors hover:border-blue-400/50 hover:bg-blue-950/35 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 transition-colors group-hover:bg-blue-500/25">
            <IconUploadPhoto className="h-9 w-9" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-100">Carregar fotografia</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-500">
              Selecciona JPEG ou PNG do teu dispositivo
            </span>
          </span>
        </button>
      </div>

      {!isMobile ? (
        <p className="text-center text-[11px] text-slate-500">
          A opção fotografar está disponível em telemóvel ou tablet.
        </p>
      ) : null}
    </div>
  );
}

function ladoLabel(lado: LadoDocumento) {
  return lado === "frente" ? "frente" : "verso";
}

/** Moldura SVG - apenas durante captura por câmara. */
function CameraDocumentFrame({
  passo,
  layout,
}: {
  passo: PassoCaptura;
  layout: LayoutDocumento;
}) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute -top-8 left-0 right-0 text-center">
        <span className="text-[11px] font-semibold text-white/90">{passo.titulo}</span>
      </div>
      <div
        className={`relative overflow-hidden rounded-xl border-2 bg-slate-950/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] ${layout.corMoldura}`}
        style={{ width: "88%", aspectRatio: String(ID1_ASPECT) }}
      >
        {passo.overlaySvg ? (
          <img
            src={passo.overlaySvg}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            style={{ opacity: passo.overlayOpacity ?? 0.32 }}
          />
        ) : (
          passo.zonas.map((z) => (
            <div
              key={z.id}
              className={`absolute pointer-events-none ${z.className ?? "border border-white/25"}`}
              style={{
                top: `${z.top}%`,
                left: `${z.left}%`,
                width: `${z.width}%`,
                height: `${z.height}%`,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

async function openRearCamera(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { exact: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    },
  ];
  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export function DocumentCaptureModule({ tipo, disabled, ladosEnviados = [], onCapture }: Props) {
  const layout = DOCUMENTO_LAYOUTS[tipo];
  const isMobile = useMobileDevice();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const passosPendentes = layout.passos.filter((p) => !ladosEnviados.includes(p.lado));
  const completo = passosPendentes.length === 0;
  /** Fluxo sequencial: sempre o primeiro lado pendente (frente → verso). */
  const passoAtual = passosPendentes[0] ?? null;
  const passoNumero = passoAtual
    ? layout.passos.findIndex((p) => p.lado === passoAtual.lado) + 1
    : 0;
  const totalPassos = layout.passos.length;

  const [mode, setMode] = useState<"idle" | "camera" | "preview">("idle");
  const [captureMethod, setCaptureMethod] = useState<CaptureMethod | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewLado, setPreviewLado] = useState<LadoDocumento>("frente");
  const [validation, setValidation] = useState<ValidacaoDocumento | null>(null);
  const [validating, setValidating] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    setMode("idle");
    setCaptureMethod(null);
    setValidation(null);
    setCameraErr(null);
  }, [ladosEnviados.join(","), tipo]);

  async function runValidation(file: File): Promise<ValidacaoDocumento> {
    setValidating(true);
    setValidation(null);
    const result = await validarImagemDocumento(file, {
      validarProporcao: layout.validarProporcao,
    });
    setValidation(result);
    setValidating(false);
    return result;
  }

  async function preparePreview(file: File, lado: LadoDocumento) {
    setPreviewLado(lado);
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMode("preview");
    await runValidation(file);
  }

  async function startCamera() {
    if (completo || !isMobile || !passoAtual) return;
    setCameraErr(null);
    try {
      const stream = await openRearCamera();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("camera");
    } catch {
      setCaptureMethod(null);
      setCameraErr(
        "Não foi possível abrir a câmara traseira. Verifica permissões ou carrega uma foto do documento.",
      );
    }
  }

  function captureFromVideo() {
    const video = videoRef.current;
    if (!video || !passoAtual) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const frameW = Math.min(vw * 0.88, vh * 0.55 * ID1_ASPECT);
    const frameH = frameW / ID1_ASPECT;
    const sx = (vw - frameW) / 2;
    const sy = (vh - frameH) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(frameW);
    canvas.height = Math.round(frameH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, frameW, frameH, 0, 0, frameW, frameH);

    canvas.toBlob(
      (blob) => {
        if (!blob || !passoAtual) return;
        stopCamera();
        const name = `${tipo}-${passoAtual.lado}-${Date.now()}.jpg`;
        const file = new File([blob], name, { type: "image/jpeg" });
        void preparePreview(file, passoAtual.lado);
      },
      "image/jpeg",
      0.92,
    );
  }

  async function onFileSelected(file: File | undefined) {
    if (!file || !passoAtual) return;
    await preparePreview(file, passoAtual.lado);
  }

  function confirmUpload() {
    if (previewFile && validation?.ok) {
      onCapture(previewFile, previewLado);
    }
    resetPreview();
  }

  function cancelCamera() {
    stopCamera();
    setMode("idle");
    setCaptureMethod(null);
  }

  function resetPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
    setValidation(null);
    setValidating(false);
    setMode("idle");
    setCaptureMethod(null);
    stopCamera();
  }

  function backToMethodChoice() {
    setCaptureMethod(null);
    setCameraErr(null);
  }

  async function chooseCamera() {
    setCaptureMethod("camera");
    await startCamera();
  }

  function chooseUpload() {
    setCaptureMethod("upload");
    setCameraErr(null);
  }

  return (
    <div
      className={`space-y-4 rounded-xl border p-4 transition-colors ${
        completo ? "border-teal-500/30 bg-teal-500/5" : "border-slate-700/40 bg-slate-900/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">{layout.titulo}</p>
            <p className="mt-0.5 text-xs text-slate-500">{layout.descricao}</p>
          </div>
        </div>
        {completo ? (
          <Badge variant="green" className="shrink-0 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Enviado
          </Badge>
        ) : null}
      </div>

      {!completo && layout.passos.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {layout.passos.map((p) => {
            const done = ladosEnviados.includes(p.lado);
            const current = p.lado === passoAtual?.lado;
            return (
              <span
                key={p.lado}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                  done
                    ? "bg-teal-500/20 text-teal-300"
                    : current
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-slate-800 text-slate-500"
                }`}
              >
                {ladoLabel(p.lado)}
                {done ? " ✓" : ""}
              </span>
            );
          })}
        </div>
      ) : null}

      {completo ? (
        <p className="text-xs text-teal-400/90">
          Documento registado. Para substituir, contacta a entidade formadora.
        </p>
      ) : null}

      {mode === "idle" && !completo && passoAtual ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 px-4 py-3">
            <p className="text-xs font-semibold text-blue-300">
              {totalPassos > 1
                ? `Passo ${passoNumero} de ${totalPassos} - ${passoAtual.titulo}`
                : passoAtual.titulo}
            </p>
            <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{passoAtual.instrucao}</p>
            {passoAtual.lado === "verso" ? (
              <p className="mt-2 text-xs text-slate-500">
                A frente já foi registada. Agora fotografa ou carrega o verso numa imagem separada.
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-700/30 bg-slate-800/20 p-4">
            {captureMethod === null ? (
              <CaptureMethodChoice
                lado={passoAtual.lado}
                isMobile={isMobile}
                disabled={disabled}
                onChooseCamera={() => void chooseCamera()}
                onChooseUpload={chooseUpload}
              />
            ) : captureMethod === "upload" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                    <IconUploadPhoto className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      Carregar {ladoLabel(passoAtual.lado)}
                    </p>
                    <p className="text-xs text-slate-500">JPEG ou PNG, máximo 10 MB</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_IMAGE}
                  className="sr-only"
                  disabled={disabled}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    void onFileSelected(f);
                    e.target.value = "";
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={disabled}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Escolher ficheiro
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={backToMethodChoice}>
                    Voltar
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  A imagem será analisada quanto à legibilidade e formato antes do envio.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {cameraErr ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-400">{cameraErr}</p>
          <Button type="button" size="sm" variant="ghost" onClick={backToMethodChoice}>
            Escolher outra opção
          </Button>
        </div>
      ) : null}

      {mode === "camera" && passoAtual ? (
        <div className="relative aspect-[4/3] max-h-96 overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <CameraDocumentFrame passo={passoAtual} layout={layout} />
          </div>
          <p className="absolute left-0 right-0 top-2 px-4 text-center text-[10px] text-white/70">
            {passoAtual.instrucao}
          </p>
          <div className="pointer-events-auto absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-3">
            <Button type="button" size="sm" onClick={captureFromVideo}>
              <ImagePlus className="h-4 w-4" />
              Capturar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={cancelCamera}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "preview" && previewFile ? (
        <div className="space-y-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Pré-visualização"
              className="mx-auto max-h-52 rounded-lg border border-slate-700/50 object-contain"
            />
          ) : null}

          {validating ? (
            <p className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              A verificar legibilidade e formato…
            </p>
          ) : validation?.ok ? (
            <p className="flex items-center justify-center gap-2 rounded-lg border border-teal-500/25 bg-teal-950/30 px-3 py-2 text-xs text-teal-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Imagem válida - legível e dentro do formato pedido ({ladoLabel(previewLado)}).
            </p>
          ) : validation && !validation.ok ? (
            <div className="space-y-1.5 rounded-lg border border-red-500/25 bg-red-950/30 px-3 py-2">
              <p className="flex items-center gap-2 text-xs font-medium text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                A imagem não cumpre os requisitos:
              </p>
              <ul className="list-disc pl-5 text-xs text-red-200/90 space-y-0.5">
                {validation.erros.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || validating || !validation?.ok}
              onClick={confirmUpload}
            >
              Confirmar envio
              {passosPendentes.length > 1 ? <ChevronRight className="h-4 w-4" /> : null}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={resetPreview}>
              Repetir
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
