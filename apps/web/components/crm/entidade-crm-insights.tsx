"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare, Sparkles } from "lucide-react";
import { CRM_SUGESTAO_REJEICAO_MOTIVOS, mensagemAceiteSugestao, type CrmSugestaoExecucao, type CrmSugestaoRejeicaoMotivo } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { notifyCrmSugestoesUpdated } from "@/lib/crm/sugestoes-events";
import { parsePaginatedList } from "@/lib/crm/paginated-list";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { NotaRegistoCard, type NotaRegisto, type NotaSugestao } from "@/components/crm/nota-registo-card";
import { ContextSugestoesBadge } from "@/components/crm/crm-sugestoes-panel";

type SugestaoApi = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  score: number | string;
  estado: string;
  interaccao: { id: string } | null;
  leadComercial?: { id: string; codigo: string; empresaNome: string } | null;
};

type InteraccaoApi = {
  id: string;
  tipo: string;
  titulo: string | null;
  contexto: string | null;
  situacaoActual: string | null;
  dorNecessidade: string | null;
  orcamentoTiming: string | null;
  decisor: string | null;
  proximoPassoNota: string | null;
  notasLivres: string | null;
  resumoIa: string | null;
  proximosPassosIa: unknown;
  processamentoEstado: string;
  processamentoEngine: string | null;
  processamentoErro: string | null;
  createdAt: string;
  criadoPor?: { displayName: string } | null;
  sugestoesIa?: Array<{
    id: string;
    titulo: string;
    descricao?: string;
    estado: string;
    tipo: string;
    score?: number;
  }>;
};

const TIPOS = ["REUNIAO", "TELEFONE", "EMAIL", "NOTA", "OUTRO"] as const;

const emptyNota = {
  tipo: "REUNIAO" as (typeof TIPOS)[number],
  titulo: "",
  contexto: "",
  situacaoActual: "",
  dorNecessidade: "",
  orcamentoTiming: "",
  decisor: "",
  proximoPassoNota: "",
  notasLivres: "",
};

type Props = {
  entidadeClienteId?: string;
  leadComercialId?: string;
  contextoNome: string;
  onMutate?: () => void;
};

function toSugestao(s: {
  id: string;
  titulo: string;
  descricao?: string;
  estado: string;
  tipo: string;
  score?: number | string;
  leadComercial?: { id: string; codigo: string; empresaNome: string } | null;
}): NotaSugestao {
  return {
    id: s.id,
    titulo: s.titulo,
    descricao: s.descricao ?? "",
    estado: s.estado,
    tipo: s.tipo,
    score: s.score,
    leadComercial: s.leadComercial ?? null,
  };
}

function mergeNotas(interaccoes: InteraccaoApi[], sugestoes: SugestaoApi[]): NotaRegisto[] {
  const porInteraccao = new Map<string, NotaSugestao[]>();
  for (const s of sugestoes) {
    const iid = s.interaccao?.id;
    if (!iid) continue;
    const list = porInteraccao.get(iid) ?? [];
    list.push(toSugestao(s));
    porInteraccao.set(iid, list);
  }

  return interaccoes.map((i) => {
    const fromApi = (i.sugestoesIa ?? []).map(toSugestao);
    const fromFetch = porInteraccao.get(i.id) ?? [];
    const merged = new Map<string, NotaSugestao>();
    for (const s of [...fromApi, ...fromFetch]) merged.set(s.id, s);

    return {
      id: i.id,
      tipo: i.tipo,
      titulo: i.titulo,
      contexto: i.contexto,
      situacaoActual: i.situacaoActual,
      dorNecessidade: i.dorNecessidade,
      orcamentoTiming: i.orcamentoTiming,
      decisor: i.decisor,
      proximoPassoNota: i.proximoPassoNota,
      notasLivres: i.notasLivres,
      resumoIa: i.resumoIa,
      proximosPassosIa: i.proximosPassosIa,
      processamentoEstado: i.processamentoEstado,
      processamentoEngine: i.processamentoEngine,
      processamentoErro: i.processamentoErro,
      createdAt: i.createdAt,
      criadoPor: i.criadoPor,
      sugestoes: [...merged.values()],
    };
  });
}

export function EntidadeCrmInsights(props: Props) {
  return <CrmContextInsights {...props} />;
}

export function CrmContextInsights({
  entidadeClienteId,
  leadComercialId,
  contextoNome,
  onMutate,
}: Props) {
  const [interaccoesRaw, setInteraccoesRaw] = useState<InteraccaoApi[]>([]);
  const [sugestoesRaw, setSugestoesRaw] = useState<SugestaoApi[]>([]);
  const [form, setForm] = useState(emptyNota);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState<CrmSugestaoRejeicaoMotivo>(CRM_SUGESTAO_REJEICAO_MOTIVOS[0]);
  const [rejectComentario, setRejectComentario] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enabled = !!(entidadeClienteId || leadComercialId);

  const notas = useMemo(
    () => mergeNotas(interaccoesRaw, sugestoesRaw),
    [interaccoesRaw, sugestoesRaw],
  );

  const pendentes = useMemo(
    () => sugestoesRaw.filter((s) => s.estado === "PENDENTE"),
    [sugestoesRaw],
  );

  const processando = useMemo(
    () => interaccoesRaw.some((i) => i.processamentoEstado === "PENDENTE"),
    [interaccoesRaw],
  );

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const interQ = entidadeClienteId
      ? `entidadeClienteId=${entidadeClienteId}`
      : `leadComercialId=${leadComercialId}`;
    const sugestoesParams = new URLSearchParams({ limit: "50" });
    if (entidadeClienteId) sugestoesParams.set("entidadeClienteId", entidadeClienteId);
    if (leadComercialId) sugestoesParams.set("leadComercialId", leadComercialId);
    const [sRes, iRes] = await Promise.all([
      bffFetch(`/api/v1/crm/sugestoes-ia?${sugestoesParams}`, {
        headers: { accept: "application/json" },
      }),
      bffFetch(`/api/v1/crm/interaccoes?${interQ}&pageSize=50`, {
        headers: { accept: "application/json" },
      }),
    ]);
    if (sRes.ok) {
      const raw = await sRes.json();
      setSugestoesRaw(Array.isArray(raw) ? (raw as SugestaoApi[]) : []);
    }
    if (iRes.ok) {
      setInteraccoesRaw(parsePaginatedList<InteraccaoApi>(await iRes.json()).items);
    }
    setLoading(false);
  }, [enabled, entidadeClienteId, leadComercialId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!processando) return;
    pollRef.current = setInterval(() => void load(), 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [processando, load]);

  async function onSubmitNota(e: FormEvent) {
    e.preventDefault();
    const temConteudo =
      form.contexto.trim() ||
      form.situacaoActual.trim() ||
      form.dorNecessidade.trim() ||
      form.orcamentoTiming.trim() ||
      form.decisor.trim() ||
      form.proximoPassoNota.trim() ||
      form.notasLivres.trim();
    if (!temConteudo) {
      setError("Escreve pelo menos um campo da reunião.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await bffFetch("/api/v1/crm/interaccoes", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        tipo: form.tipo,
        titulo: form.titulo.trim() || undefined,
        contexto: form.contexto.trim() || undefined,
        situacaoActual: form.situacaoActual.trim() || undefined,
        dorNecessidade: form.dorNecessidade.trim() || undefined,
        orcamentoTiming: form.orcamentoTiming.trim() || undefined,
        decisor: form.decisor.trim() || undefined,
        proximoPassoNota: form.proximoPassoNota.trim() || undefined,
        notasLivres: form.notasLivres.trim() || undefined,
        entidadeClienteId: entidadeClienteId || undefined,
        leadComercialId: leadComercialId || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(await parseApiError(res));
      return;
    }
    setForm(emptyNota);
    setMsg("Nota guardada - a IA analisa em background. O registo aparece abaixo.");
    void load();
    onMutate?.();
  }

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
      notifyCrmSugestoesUpdated();
      void load();
      onMutate?.();
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
      void load();
      onMutate?.();
    }
  }

  if (!enabled) return null;

  if (loading) {
    return (
      <Card className="mb-6 border-slate-700/50">
        <CardContent className="pt-6 text-sm text-slate-500">A carregar notas…</CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {msg ? <Alert variant="success">{msg}</Alert> : null}

      {processando ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          A processar a nota mais recente - o registo já está visível; a análise IA chega em seguida.
        </div>
      ) : null}

      <Card className="border-slate-600/50">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-slate-400" />
              Registos de reunião - {contextoNome}
            </CardTitle>
            {pendentes.length > 0 ? (
              <Badge variant="purple" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {pendentes.length} sugestão(ões) por validar
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {notas.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ainda não há notas registadas para este cliente. Usa o formulário abaixo para a primeira reunião.
            </p>
          ) : (
            notas.map((nota, idx) => (
              <NotaRegistoCard
                key={nota.id}
                nota={nota}
                busy={busy}
                defaultExpanded={idx === 0}
                onAceitar={(id) => void aceitar(id)}
                onRejeitar={(id) => setRejectId(id)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-700/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4 text-slate-400" />
            Nova nota comercial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-slate-500">
            O que escreveres fica guardado e visível no histórico acima. A IA sugere acções comerciais em seguida.
          </p>
          <form onSubmit={(e) => void onSubmitNota(e)} className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as typeof form.tipo }))}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Input
              label="Título (opcional)"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex.: Reunião Q2 formação"
            />
            <Textarea
              label="Contexto / participantes"
              className="sm:col-span-2"
              rows={2}
              value={form.contexto}
              onChange={(e) => setForm((f) => ({ ...f, contexto: e.target.value }))}
            />
            <Textarea
              label="Situação actual"
              rows={2}
              value={form.situacaoActual}
              onChange={(e) => setForm((f) => ({ ...f, situacaoActual: e.target.value }))}
            />
            <Textarea
              label="Dor / necessidade"
              rows={2}
              value={form.dorNecessidade}
              onChange={(e) => setForm((f) => ({ ...f, dorNecessidade: e.target.value }))}
            />
            <Textarea
              label="Orçamento e timing"
              rows={2}
              value={form.orcamentoTiming}
              onChange={(e) => setForm((f) => ({ ...f, orcamentoTiming: e.target.value }))}
            />
            <Textarea
              label="Decisor"
              rows={2}
              value={form.decisor}
              onChange={(e) => setForm((f) => ({ ...f, decisor: e.target.value }))}
            />
            <Textarea
              label="Próximo passo acordado"
              className="sm:col-span-2"
              rows={2}
              value={form.proximoPassoNota}
              onChange={(e) => setForm((f) => ({ ...f, proximoPassoNota: e.target.value }))}
            />
            <Textarea
              label="Notas livres"
              className="sm:col-span-2"
              rows={3}
              value={form.notasLivres}
              onChange={(e) => setForm((f) => ({ ...f, notasLivres: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "A guardar…" : "Guardar nota"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={rejectId != null} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent title="Rejeitar sugestão" description="Ajuda a IA a melhorar futuras sugestões.">
          <div className="grid gap-3">
            <Select
              label="Motivo"
              value={rejectMotivo}
              onChange={(e) => setRejectMotivo(e.target.value as CrmSugestaoRejeicaoMotivo)}
            >
              {CRM_SUGESTAO_REJEICAO_MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Textarea
              label="Comentário (opcional)"
              rows={2}
              value={rejectComentario}
              onChange={(e) => setRejectComentario(e.target.value)}
            />
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void rejeitar()}>
                Confirmar rejeição
              </Button>
              <Button variant="secondary" onClick={() => setRejectId(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Mapa entidadeId → nº sugestões pendentes (para listagens). */
export function useSugestoesPendentesPorEntidade() {
  const [mapa, setMapa] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      const res = await bffFetch("/api/v1/crm/sugestoes-ia?estado=PENDENTE&limit=100", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return;
      const raw = await res.json();
      const items = Array.isArray(raw) ? raw : [];
      const next: Record<string, number> = {};
      for (const s of items as Array<{ entidadeCliente: { id: string } | null }>) {
        const id = s.entidadeCliente?.id;
        if (id) next[id] = (next[id] ?? 0) + 1;
      }
      setMapa(next);
    })();
  }, []);

  return mapa;
}

export function useSugestoesPendentesPorLead() {
  const [mapa, setMapa] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      const res = await bffFetch("/api/v1/crm/sugestoes-ia?estado=PENDENTE&limit=100", {
        headers: { accept: "application/json" },
      });
      if (!res.ok) return;
      const raw = await res.json();
      const items = Array.isArray(raw) ? raw : [];
      const next: Record<string, number> = {};
      for (const s of items as Array<{ leadComercial: { id: string } | null }>) {
        const id = s.leadComercial?.id;
        if (id) next[id] = (next[id] ?? 0) + 1;
      }
      setMapa(next);
    })();
  }, []);

  return mapa;
}

export function EntidadeSugestoesBadge({ entidadeId, mapa }: { entidadeId: string; mapa: Record<string, number> }) {
  return <ContextSugestoesBadge count={mapa[entidadeId] ?? 0} />;
}
