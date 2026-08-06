"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { bffFetch } from "@/lib/client/bff-fetch";
import { extractPresencaToken } from "@/lib/client/presenca-qr-token";
import { parseApiError } from "@/lib/ui/backoffice";
import { cn } from "@/lib/ui/cn";

type CheckinResult = {
  ok: boolean;
  alreadyPresent: boolean;
  formando: string;
  sessao: { numeroSessao: number };
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: CheckinResult) => void;
};

type Phase = "camera" | "submitting" | "success" | "error";

export function PresencaQrScanModal({ open, onClose, onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const handledRef = useRef(false);
  const openRef = useRef(open);
  const onSuccessRef = useRef(onSuccess);
  const startGenRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("camera");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  openRef.current = open;
  onSuccessRef.current = onSuccess;

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    scanningRef.current = false;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const submitToken = useCallback(
    async (token: string) => {
      if (handledRef.current || !openRef.current) return;
      handledRef.current = true;
      scanningRef.current = false;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      stopCamera();
      setCameraReady(false);
      setPhase("submitting");
      setErr(null);

      try {
        const res = await bffFetch(`/api/v1/presenca-checkin/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { accept: "application/json" },
        });
        if (!openRef.current) return;
        if (!res.ok) {
          setErr(await parseApiError(res));
          setPhase("error");
          handledRef.current = false;
          return;
        }
        const data = (await res.json()) as CheckinResult;
        if (!openRef.current) return;
        setResult(data);
        setPhase("success");
        onSuccessRef.current?.(data);
      } catch {
        if (!openRef.current) return;
        setErr("Não foi possível registar a presença. Tenta novamente.");
        setPhase("error");
        handledRef.current = false;
      }
    },
    [stopCamera],
  );

  const startCamera = useCallback(async () => {
    if (!openRef.current) return;
    const gen = ++startGenRef.current;
    stopCamera();
    handledRef.current = false;
    setPhase("camera");
    setErr(null);
    setResult(null);
    setCameraReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setErr("Este dispositivo não permite aceder à câmara.");
      setPhase("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      // Geração antiga (ex.: modal fechou / retry) - larga o stream.
      if (gen !== startGenRef.current || !openRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        for (const track of stream.getTracks()) track.stop();
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (gen !== startGenRef.current || !openRef.current) {
        stopCamera();
        return;
      }
      setCameraReady(true);
      scanningRef.current = true;

      const { default: jsQR } = await import("jsqr");
      if (gen !== startGenRef.current || !openRef.current) return;

      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setErr("Não foi possível iniciar o leitor de QR.");
        setPhase("error");
        return;
      }

      const tick = () => {
        if (gen !== startGenRef.current) return;
        if (!scanningRef.current || handledRef.current || !openRef.current) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2) {
          const w = v.videoWidth;
          const h = v.videoHeight;
          if (w > 0 && h > 0) {
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const image = ctx.getImageData(0, 0, w, h);
            const code = jsQR(image.data, image.width, image.height, {
              inversionAttempts: "dontInvert",
            });
            if (code?.data) {
              const token = extractPresencaToken(code.data);
              if (token) {
                void submitToken(token);
                return;
              }
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      if (gen !== startGenRef.current || !openRef.current) return;
      setErr(
        "Não foi possível abrir a câmara. Autoriza o acesso e aponta para o QR do formador.",
      );
      setPhase("error");
    }
  }, [stopCamera, submitToken]);

  // Só reage a abrir/fechar o modal - NÃO a callbacks do pai (evita reiniciar a câmara).
  useEffect(() => {
    if (!open) {
      startGenRef.current += 1;
      stopCamera();
      setCameraReady(false);
      setPhase("camera");
      setErr(null);
      setResult(null);
      handledRef.current = false;
      return;
    }
    void startCamera();
    return () => {
      startGenRef.current += 1;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startCamera/stopCamera estáveis via refs de ciclo
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        title="Ler código de presença"
        description="Aponta a câmara traseira para o QR mostrado pelo formador."
        className="max-w-md"
      >
        <div className="space-y-4">
          {phase === "camera" || phase === "submitting" ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-black aspect-[3/4] max-h-[min(55vh,420px)]">
              {/* Mantém o <video> montado durante submitting para não flicker no unmount. */}
              <video
                ref={videoRef}
                className={cn(
                  "h-full w-full object-cover",
                  (!cameraReady || phase === "submitting") && "opacity-0",
                )}
                playsInline
                muted
                autoPlay
              />
              {phase === "camera" && !cameraReady ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 gap-2">
                  <Camera className="h-4 w-4 animate-pulse" />
                  A abrir câmara…
                </div>
              ) : null}
              {phase === "submitting" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-teal-200">
                  A registar presença…
                </div>
              ) : null}
              {phase === "camera" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-44 w-44 rounded-2xl border-2 border-teal-400/70 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "success" && result ? (
            <div className="rounded-xl border border-teal-500/35 bg-teal-950/30 px-4 py-6 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-10 w-10 text-teal-400" />
              <p className="text-base font-semibold text-slate-100">
                {result.alreadyPresent
                  ? "Presença já registada"
                  : "Presença registada com sucesso"}
              </p>
              <p className="text-sm text-slate-400">
                {result.formando} · Sessão {result.sessao.numeroSessao}
              </p>
              <Button type="button" className="mt-2 w-full" onClick={onClose}>
                Fechar
              </Button>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-4 space-y-3">
              <p className="text-sm text-amber-100">{err ?? "Não foi possível ler o código."}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => void startCamera()}
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
                <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "camera" ? (
            <p className="text-xs text-slate-500 text-center leading-snug">
              Mantém o código dentro do quadrado. O registo é automático quando o QR for lido.
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
