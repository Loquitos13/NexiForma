"use client";

import { useEffect } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Regista push notifications (gestor/comercial) quando o browser suporta. */
export function PortalPushRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        } catch {
          return;
        }

        const keyRes = await bffFetch("/api/v1/notificacoes/push/vapid-public-key", {
          headers: { accept: "application/json" },
        });
        if (!keyRes.ok) return;
        const { enabled, publicKey } = (await keyRes.json()) as {
          enabled?: boolean;
          publicKey?: string | null;
        };
        if (!enabled || !publicKey) return;

        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        await bffFetch("/api/v1/notificacoes/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          }),
        });
      })().catch(() => {
        /* push opcional */
      });
    }, 4000);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
