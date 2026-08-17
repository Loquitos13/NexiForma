"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { notifyDocumentosObrigatoriosUpdated } from "@/components/portal/documentos-obrigatorios-gate";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";

export type ChecklistDocItem = {
  id: string;
  label: string;
  completo: boolean;
  detalhe?: string;
  obrigatorio: boolean;
  origem?: string;
};

type Props = {
  title?: string;
  /** IDs que podem ser marcados como exigidos (política tenant). */
  imponivelIds: string[];
  /** IDs sempre exigidos pelo cargo (checkbox desactivado). */
  lockedRequiredIds?: string[];
  loadChecklist: () => Promise<ChecklistDocItem[] | null>;
  onSaved?: () => void;
  canManageImposicao?: boolean;
};

export function ChecklistDocumentalCard({
  title = "Checklist documental",
  imponivelIds,
  lockedRequiredIds = [],
  loadChecklist,
  onSaved,
  canManageImposicao = false,
}: Props) {
  const [items, setItems] = useState<ChecklistDocItem[] | null>(null);
  const [draftRequired, setDraftRequired] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await loadChecklist();
    if (data) {
      setItems(data);
      setDraftRequired(data.filter((i) => i.obrigatorio && imponivelIds.includes(i.id)).map((i) => i.id));
    }
  }, [loadChecklist, imponivelIds]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function toggleRequired(id: string) {
    if (!imponivelIds.includes(id)) return;
    setDraftRequired((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function guardarImposicao() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const locked = lockedRequiredIds.filter((id) => imponivelIds.includes(id));
    const universaisObrigatorios = [...new Set([...draftRequired, ...locked])];
    const r = await bffFetch("/api/v1/portal/tenant/documentos-politica", {
      method: "PUT",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ universaisObrigatorios }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    setMsg("Política de documentos actualizada.");
    notifyDocumentosObrigatoriosUpdated();
    await refresh();
    onSaved?.();
  }

  const lockedSet = new Set(lockedRequiredIds);

  return (
    <Card className="mb-6">
      <CardHeader className="border-b border-slate-700/40 flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {canManageImposicao ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void guardarImposicao()}>
            {busy ? "A guardar…" : "Guardar imposição"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {msg ? <Alert variant="success">{msg}</Alert> : null}
        {items ? (
          <ul className="space-y-2">
            {items.map((item) => {
              const isLocked = lockedSet.has(item.id);
              const canToggle = canManageImposicao && imponivelIds.includes(item.id);
              const checked =
                item.obrigatorio ||
                draftRequired.includes(item.id) ||
                isLocked;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/30 bg-slate-900/30 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    {canManageImposicao && imponivelIds.includes(item.id) ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLocked || busy}
                        onChange={() => toggleRequired(item.id)}
                        className="mt-0.5 rounded border-slate-600"
                        title={isLocked ? "Obrigatório do cargo" : "Exigir este documento"}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <span className="text-slate-200">{item.label}</span>
                      {!item.obrigatorio && !draftRequired.includes(item.id) && !isLocked ? (
                        <span className="ml-2 text-[10px] text-slate-500 uppercase">Opcional</span>
                      ) : null}
                      {item.origem === "cargo" ? (
                        <span className="ml-2 text-[10px] text-slate-500">(cargo)</span>
                      ) : null}
                    </div>
                  </div>
                  <Badge variant={item.completo ? "green" : item.obrigatorio ? "yellow" : "default"}>
                    {item.completo ? "OK" : item.obrigatorio ? "Em falta" : "-"}
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">A carregar checklist…</p>
        )}
        {canManageImposicao ? (
          <p className="text-xs text-slate-500">
            Marque os documentos exigidos na ficha universal e clique em «Guardar imposição».
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
