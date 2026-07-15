"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import {
  CRM_SUGESTAO_REJEICAO_MOTIVOS,
  inferirAcaoPlaneada,
  mensagemAceiteSugestao,
  type CrmSugestaoExecucao,
  type CrmSugestaoRejeicaoMotivo,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { notifyCrmSugestoesUpdated } from "@/lib/crm/sugestoes-events";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  Select,
  Textarea,
} from "@/components/ui";
import { fmtDate } from "@/lib/crm/shared";

type Sugestao = {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  estado: string;
  score: number | string;
  engine: string;
  createdAt: string;
  validadoEm: string | null;
  validadoPor: { displayName: string } | null;
  motivoRejeicao: string | null;
  metadata?: unknown;
  execucao?: CrmSugestaoExecucao | null;
};

type Props = {
  entidadeId: string;
};

export function ClienteFichaSugestoes({ entidadeId }: Props) {
  const { canManageCrm } = useTenantRole();
  const [items, setItems] = useState<Sugestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState<CrmSugestaoRejeicaoMotivo>(CRM_SUGESTAO_REJEICAO_MOTIVOS[0]);
  const [rejectComentario, setRejectComentario] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const res = await bffFetch(
      `/api/v1/crm/sugestoes-ia?entidadeClienteId=${entidadeId}&limit=100`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setItems((await res.json()) as Sugestao[]);
  }, [entidadeId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (canManageCrm) {
      await bffFetch(`/api/v1/crm/entidades/${entidadeId}/sugestoes-ia/gerar`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
    }
    await fetchList();
    setLoading(false);
  }, [entidadeId, canManageCrm, fetchList]);

  useEffect(() => {
    void load();
  }, [load]);

  async function aceitar(id: string) {
    setBusy(true);
    setMsg(null);
    const res = await bffFetch(`/api/v1/crm/sugestoes-ia/${id}/aceitar`, {
      method: "POST",
      headers: { accept: "application/json" },
    });
    setBusy(false);
    if (!res.ok) setError(await parseApiError(res));
    else {
      const data = (await res.json()) as {
        leadComercial?: { codigo: string } | null;
        execucao?: CrmSugestaoExecucao | null;
      };
      setMsg(mensagemAceiteSugestao(data));
      setItems((prev) => prev.filter((s) => s.id !== id));
      notifyCrmSugestoesUpdated();
      void fetchList();
    }
  }

  async function rejeitar() {
    if (!rejectId) return;
    setBusy(true);
    const res = await bffFetch(`/api/v1/crm/sugestoes-ia/${rejectId}/rejeitar`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ motivo: rejectMotivo, comentario: rejectComentario.trim() || undefined }),
    });
    setBusy(false);
    setRejectId(null);
    if (!res.ok) setError(await parseApiError(res));
    else {
      notifyCrmSugestoesUpdated();
      void fetchList();
    }
  }

  if (loading) return <p className="text-sm text-slate-500">A carregar sugestões…</p>;

  const pendentes = items.filter((s) => s.estado === "PENDENTE");
  const historico = items.filter((s) => s.estado !== "PENDENTE");

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {pendentes.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-slate-300">Pendentes ({pendentes.length})</h3>
          {pendentes.map((s) => (
            <SugestaoCard
              key={s.id}
              s={s}
              canManage={canManageCrm}
              busy={busy}
              onAceitar={() => void aceitar(s.id)}
              onRejeitar={() => {
                setRejectId(s.id);
                setRejectMotivo(CRM_SUGESTAO_REJEICAO_MOTIVOS[0]);
                setRejectComentario("");
              }}
            />
          ))}
        </section>
      ) : (
        <p className="text-sm text-slate-500">
          Sem sugestões pendentes. A IA analisa notas, leads e propostas - registe uma nota comercial
          para novas oportunidades.
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-slate-300">Histórico ({historico.length})</h3>
        {historico.length === 0 ? (
          <p className="text-sm text-slate-500">Sem decisões registadas.</p>
        ) : (
          historico.map((s) => (
            <SugestaoCard key={s.id} s={s} canManage={false} busy={false} />
          ))
        )}
      </section>

      <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
        <DialogContent title="Rejeitar sugestão">
          <div className="space-y-3">
            <Select value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value as CrmSugestaoRejeicaoMotivo)}>
              {CRM_SUGESTAO_REJEICAO_MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Textarea
              rows={2}
              value={rejectComentario}
              onChange={(e) => setRejectComentario(e.target.value)}
              placeholder="Comentário (opcional)"
            />
            <Button variant="secondary" disabled={busy} onClick={() => void rejeitar()}>
              Confirmar rejeição
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SugestaoCard({
  s,
  canManage,
  busy,
  onAceitar,
  onRejeitar,
}: {
  s: Sugestao;
  canManage?: boolean;
  busy?: boolean;
  onAceitar?: () => void;
  onRejeitar?: () => void;
}) {
  const planeada =
    s.estado === "PENDENTE" ? inferirAcaoPlaneada(s.metadata, s.titulo, s.tipo) : null;
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" />
              <p className="font-medium text-slate-100">{s.titulo}</p>
              <Badge variant="default">{s.tipo.replace("_", " ")}</Badge>
              <Badge
                variant={
                  s.estado === "PENDENTE" ? "yellow" : s.estado === "ACEITE" ? "green" : "red"
                }
              >
                {s.estado}
              </Badge>
            </div>
            <p className="text-sm text-slate-300">{s.descricao}</p>
            {planeada ? (
              <p className="text-xs text-violet-300/90">
                Será executado ao aceitar: {planeada}
              </p>
            ) : null}
            {s.execucao ? (
              <p className={`text-xs ${s.execucao.sucesso ? "text-emerald-400" : "text-amber-400"}`}>
                {s.execucao.sucesso ? "Executado" : "Execução falhou"}: {s.execucao.mensagem}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              {fmtDate(s.createdAt)} · score {Number(s.score).toFixed(0)}
              {s.validadoPor
                ? ` · ${s.estado === "ACEITE" ? "Aceite" : "Rejeitada"} por ${s.validadoPor.displayName}`
                : ""}
              {s.validadoEm ? ` · ${fmtDate(s.validadoEm)}` : ""}
              {s.motivoRejeicao ? ` · ${s.motivoRejeicao}` : ""}
            </p>
          </div>
          {canManage && s.estado === "PENDENTE" ? (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={busy} onClick={onAceitar}>
                <Check className="h-3.5 w-3.5" />
                Aceitar e executar
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={onRejeitar}>
                <X className="h-3.5 w-3.5" />
                Rejeitar
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
