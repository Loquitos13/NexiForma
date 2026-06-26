"use client";

import { useEffect } from "react";

/** Regista service worker PWA apenas no portal do formando (produção). */
export function FormandoPwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* unsupported – ignorar */
    });
  }, []);

  return null;
}
