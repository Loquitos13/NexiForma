"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { formatDatePt } from "@/lib/calendar-date";
import { parseApiError } from "@/lib/ui/backoffice";
import { Alert, Button, Card, CardContent } from "@/components/ui";

type CheckinInfo = {
  sessao: {
    id: string;
    numeroSessao: number;
    data: string;
    horaInicio: string;
    horaFim: string;
    iniciadaEm: string | null;
    terminadaEm: string | null;
    acao: { codigoInterno: string; titulo: string };
  };
  podeRegistar: boolean;
};

type CheckinResult = {
  ok: boolean;
  alreadyPresent: boolean;
  formando: string;
  sessao: {
    id: string;
    numeroSessao: number;
    data: string;
    horaInicio: string;
    horaFim: string;
  };
};

export default function FormandoPresencaCheckinPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [info, setInfo] = useState<CheckinInfo | null>(null);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadInfo = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/presenca-checkin/${encodeURIComponent(token)}`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseApiError(res));
        setInfo(null);
        return;
      }
      setInfo((await res.json()) as CheckinInfo);
    } catch {
      setErr("Não foi possível carregar a sessão.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  async function registar() {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await bffFetch(`/api/v1/presenca-checkin/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        setErr(await parseApiError(res));
        return;
      }
      setResult((await res.json()) as CheckinResult);
    } catch {
      setErr("Falha ao registar a presença.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-4">
      <div className="flex items-center gap-2 text-teal-300">
        <ClipboardList className="h-5 w-5" />
        <h1 className="text-lg font-semibold text-slate-100">Registo de presença</h1>
      </div>

      {loading ? <p className="text-sm text-slate-500">A carregar…</p> : null}
      {err ? <Alert variant="error">{err}</Alert> : null}

      {result ? (
        <Card className="border-teal-500/30 bg-teal-500/5">
          <CardContent className="py-6 space-y-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-teal-400 mx-auto" />
            <p className="text-base font-semibold text-slate-100">
              {result.alreadyPresent ? "Presença já registada" : "Presença registada"}
            </p>
            <p className="text-sm text-slate-400">
              {result.formando} · Sessão {result.sessao.numeroSessao} ·{" "}
              {formatDatePt(result.sessao.data)} · {result.sessao.horaInicio}–
              {result.sessao.horaFim}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {!result && info ? (
        <Card>
          <CardContent className="py-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-100">
                {info.sessao.acao.codigoInterno} – {info.sessao.acao.titulo}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Sessão {info.sessao.numeroSessao} · {formatDatePt(info.sessao.data)} ·{" "}
                {info.sessao.horaInicio} – {info.sessao.horaFim}
              </p>
            </div>
            {!info.podeRegistar ? (
              <Alert variant="warning">
                {info.sessao.terminadaEm
                  ? "Esta sessão já terminou. Já não é possível registar presença."
                  : "A sessão ainda não foi iniciada pelo formador."}
              </Alert>
            ) : (
              <Button type="button" className="w-full" disabled={busy} onClick={() => void registar()}>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar a minha presença
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
