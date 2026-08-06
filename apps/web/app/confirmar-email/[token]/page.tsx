"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "@/components/site/auth-shell";
import {
  persistLoginPreferences,
  persistTenantSlug,
  setRememberLogin,
} from "@/lib/client/login-preferences";

export default function ConfirmEmailPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token ?? "");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("A confirmar o email…");
  const [loginHref, setLoginHref] = useState("/login");

  useEffect(() => {
    if (!token || token.length < 32) {
      setStatus("error");
      setMessage("Link de confirmação inválido.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/auth/tenant/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json().catch(() => null)) as {
          message?: string | string[];
          email?: string;
          tenantSlug?: string;
          ok?: boolean;
        } | null;
        if (cancelled) return;
        if (!res.ok) {
          const m = Array.isArray(data?.message) ? data.message.join(", ") : data?.message;
          setStatus("error");
          setMessage(m ?? "Link de confirmação inválido ou expirado.");
          return;
        }
        const slug = data?.tenantSlug ?? "";
        if (slug) persistTenantSlug(slug);
        if (data?.email) {
          setRememberLogin(true);
          persistLoginPreferences({
            remember: true,
            tenantSlug: slug,
            email: data.email,
          });
        }
        const q = new URLSearchParams();
        if (slug) q.set("slug", slug);
        if (data?.email) q.set("email", data.email);
        const href = q.size ? `/login?${q.toString()}` : "/login";
        setLoginHref(href);
        setStatus("ok");
        setMessage("Email confirmado com sucesso. Já pode iniciar sessão.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Não foi possível confirmar o email. Tente novamente.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function goLogin(e: FormEvent) {
    e.preventDefault();
    router.push(loginHref);
  }

  return (
    <AuthShell
      title="Confirmar email"
      subtitle="Validação de segurança da conta registada pela administração."
    >
      <div className="space-y-4">
        {status === "loading" ? (
          <p className="text-sm text-slate-400">{message}</p>
        ) : null}

        {status === "ok" ? (
          <div className="rounded-xl border border-teal-500/25 bg-teal-950/30 px-4 py-3 text-sm text-teal-200">
            {message}
          </div>
        ) : null}

        {status === "error" ? (
          <div className="rounded-xl border border-red-500/25 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {message}
          </div>
        ) : null}

        {status === "ok" ? (
          <button
            type="button"
            onClick={(e) => goLogin(e)}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            Ir para o login
          </button>
        ) : null}

        {status === "error" ? (
          <p className="text-center text-xs text-slate-500">
            Pedir novo link em{" "}
            <Link href="/login" className="text-blue-400 hover:underline">
              login
            </Link>{" "}
            ou contactar a administração da entidade.
          </p>
        ) : null}
      </div>
    </AuthShell>
  );
}
