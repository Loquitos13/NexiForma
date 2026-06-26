"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function FormandoPwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const dismissedKey = "nexi_pwa_install_dismissed";
    if (sessionStorage.getItem(dismissedKey) === "1") {
      setDismissed(true);
    }

    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
    }
  }

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("nexi_pwa_install_dismissed", "1");
  }

  if (installed || dismissed || !deferred) {
    return null;
  }

  return (
    <div className="border-b border-blue-500/20 bg-blue-950/30">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-2.5">
        <p className="text-xs text-blue-200/90 sm:text-sm">
          Instala o portal no telemóvel para acesso rápido às sessões e cursos.
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => void install()}>
            <Download className="h-3.5 w-3.5" />
            Instalar app
          </Button>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800/50 hover:text-slate-300"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
