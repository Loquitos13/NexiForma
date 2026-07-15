"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthShell } from "@/components/site/auth-shell";
import { Alert, Button, Textarea } from "@/components/ui";
import { bffQuery } from "@/lib/client/bff-query";
import { consumeSensitiveUrlParams } from "@/lib/client/sensitive-url";
import { fmtEuro } from "@/lib/crm/shared";

type Preview = {
  codigo: string;
  titulo: string;
  estado: string;
  valorCentavos: number;
  moeda: string;
  validadeAte: string | null;
  cliente: string;
  formador: string;
  jaRespondida: boolean;
};

function PropostaResponderContent() {
  const searchParams = useSearchParams();
  const [urlSecrets, setUrlSecrets] = useState({ token: "" });
  useEffect(() => {
    const consumed = consumeSensitiveUrlParams(["token"]);
    setUrlSecrets((prev) => ({ token: consumed.token ?? prev.token }));
  }, []);

  const token = urlSecrets.token;
  const acaoParam = searchParams.get("acao")?.trim() ?? "";

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<"aceite" | "rejeitada" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmarRejeicao, setConfirmarRejeicao] = useState(acaoParam === "rejeitar");

  const load = useCallback(async () => {
    if (!token) {
      setError("Link inválido ou incompleto.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await bffQuery("/api/v1/propostas/resposta/preview", {
      body: { token },
      authRetry401: false,
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? "Não foi possível carregar a proposta.");
      return;
    }
    setPreview((await res.json()) as Preview);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function responder(acao: "aceitar" | "rejeitar") {
    if (!token) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/propostas/resposta", {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        token,
        acao,
        motivo: acao === "rejeitar" ? motivo.trim() || undefined : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(body?.message ?? "Não foi possível registar a resposta.");
      return;
    }
    setResultado(acao === "aceitar" ? "aceite" : "rejeitada");
    await load();
  }

  if (loading) {
    return (
      <AuthShell title="Proposta comercial" subtitle="A carregar…">
        <p className="text-sm text-slate-400 text-center">A validar o seu link…</p>
      </AuthShell>
    );
  }

  if (error && !preview) {
    return (
      <AuthShell title="Proposta comercial" subtitle="Link inválido">
        <Alert variant="error">{error}</Alert>
      </AuthShell>
    );
  }

  if (!preview) {
    return (
      <AuthShell title="Proposta comercial">
        <Alert variant="error">Proposta não encontrada.</Alert>
      </AuthShell>
    );
  }

  const tituloShell =
    resultado === "aceite"
      ? "Proposta aceite"
      : resultado === "rejeitada"
        ? "Proposta recusada"
        : "Responder à proposta";

  return (
    <AuthShell
      title={tituloShell}
      subtitle={`${preview.formador} · ${preview.codigo}`}
    >
      <div className="space-y-4 text-sm">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4 space-y-2">
          <p className="font-medium text-slate-100">{preview.titulo}</p>
          <p className="text-slate-400">Cliente: {preview.cliente}</p>
          <p className="text-slate-300">
            Valor: {fmtEuro(preview.valorCentavos)} {preview.moeda}
          </p>
          {preview.validadeAte ? (
            <p className="text-slate-500">
              Válida até:{" "}
              {new Date(preview.validadeAte).toLocaleDateString("pt-PT")}
            </p>
          ) : null}
        </div>

        {resultado === "aceite" || preview.estado === "ACEITE" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-teal-400" />
            <p className="text-slate-200">
              Obrigado. A sua aceitação foi registada. A entidade formadora será
              notificada.
            </p>
          </div>
        ) : resultado === "rejeitada" || preview.estado === "REJEITADA" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <XCircle className="h-12 w-12 text-slate-400" />
            <p className="text-slate-200">A recusa da proposta foi registada.</p>
          </div>
        ) : preview.jaRespondida ? (
          <Alert variant="info">Esta proposta já foi respondida.</Alert>
        ) : confirmarRejeicao ? (
          <div className="space-y-3">
            <Textarea
              label="Motivo da recusa (opcional)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Pode indicar brevemente o motivo…"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                className="flex-1"
                onClick={() => void responder("rejeitar")}
              >
                Confirmar recusa
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirmarRejeicao(false)}
              >
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="teal"
              disabled={busy}
              className="flex-1"
              onClick={() => void responder("aceitar")}
            >
              Aceitar proposta
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              className="flex-1"
              onClick={() => setConfirmarRejeicao(true)}
            >
              Recusar
            </Button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default function PropostaResponderPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Proposta comercial" subtitle="A carregar…">
          <p className="text-sm text-slate-400 text-center">A carregar…</p>
        </AuthShell>
      }
    >
      <PropostaResponderContent />
    </Suspense>
  );
}
