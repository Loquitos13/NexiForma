"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus, FileText, Loader2 } from "lucide-react";
import {
  TEMPLATE_TYPES,
  listCrmContratoTemplateOptions,
  type TenantTemplateEntry,
} from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { generateContratoCodigo } from "@/lib/crm/shared";
import { Alert, Button, Dialog, DialogContent, Input, Select } from "@/components/ui";

const NOVO_TEMPLATE_ID = "__novo__";

type EntidadeOpt = { id: string; nome: string; nif: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidades: EntidadeOpt[];
  onCreated?: (id: string) => void;
};

export function NovoContratoModal({ open, onOpenChange, entidades, onCreated }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Record<string, TenantTemplateEntry>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(NOVO_TEMPLATE_ID);
  const [entidadeClienteId, setEntidadeClienteId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateOptions = useMemo(() => {
    const fromCrm = listCrmContratoTemplateOptions(savedTemplates);
    return fromCrm.length > 0
      ? fromCrm
      : TEMPLATE_TYPES.crm.map((t) => ({ id: t.id, label: t.label, descricao: t.descricao }));
  }, [savedTemplates]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const r = await bffFetch("/api/v1/portal/tenant/document-templates?modulo=crm", {
      headers: { accept: "application/json" },
    });
    setLoadingTemplates(false);
    if (r.ok) {
      const data = (await r.json()) as { templates?: Record<string, TenantTemplateEntry> };
      setSavedTemplates(data.templates ?? {});
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setSelectedTemplateId(NOVO_TEMPLATE_ID);
      setEntidadeClienteId("");
      setTitulo("");
      setCodigo("");
      setDataInicio("");
      setDataFim("");
      setError(null);
      return;
    }
    setCodigo(generateContratoCodigo());
    void loadTemplates();
  }, [open, loadTemplates]);

  function escolherTemplate(id: string) {
    setSelectedTemplateId(id);
    setStep(1);
  }

  async function criarContrato(e: FormEvent) {
    e.preventDefault();
    if (!entidadeClienteId.trim()) {
      setError("Selecione o cliente.");
      return;
    }
    if (!titulo.trim()) {
      setError("Indique o título ou objecto do contrato.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      entidadeClienteId,
      titulo: titulo.trim(),
      codigo: codigo.trim() || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    };
    if (selectedTemplateId === NOVO_TEMPLATE_ID) {
      payload.templateId = null;
    } else {
      payload.templateId = selectedTemplateId;
    }
    const r = await bffFetch("/api/v1/contratos", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!r.ok) {
      setError(await parseApiError(r));
      return;
    }
    const created = (await r.json()) as { id: string };
    onOpenChange(false);
    onCreated?.(created.id);
    router.push(`/portal/contratos/${created.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Novo contrato" className="max-w-lg">
        {step === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">
              Reutilize um template registado no CRM ou crie um contrato personalizado sem template
              base.
            </p>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                A carregar templates…
              </div>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => escolherTemplate(NOVO_TEMPLATE_ID)}
                  className="flex items-start gap-3 rounded-lg border border-violet-500/40 bg-violet-950/20 p-3 text-left transition-colors hover:border-violet-400/60 hover:bg-violet-950/35"
                >
                  <FilePlus className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
                  <div>
                    <p className="font-medium text-slate-100">Novo (personalizado)</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Documento em branco, sem reutilizar template guardado.
                    </p>
                  </div>
                </button>
                {templateOptions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => escolherTemplate(t.id)}
                    className="flex items-start gap-3 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 text-left transition-colors hover:border-slate-600 hover:bg-slate-800/70"
                  >
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-100">{t.label}</p>
                      {"descricao" in t && t.descricao ? (
                        <p className="mt-0.5 text-xs text-slate-500">{t.descricao}</p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-600">Template CRM · {t.id}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={(e) => void criarContrato(e)} className="space-y-4">
            <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-3 py-2 text-xs text-slate-400">
              {selectedTemplateId === NOVO_TEMPLATE_ID
                ? "Contrato personalizado (sem template)"
                : `Template: ${templateOptions.find((t) => t.id === selectedTemplateId)?.label ?? selectedTemplateId}`}
              <button
                type="button"
                className="ml-2 text-violet-400 underline"
                onClick={() => setStep(0)}
              >
                Alterar
              </button>
            </div>
            <Select
              label="Cliente"
              required
              value={entidadeClienteId}
              onChange={(e) => setEntidadeClienteId(e.target.value)}
            >
              <option value="">Selecionar cliente…</option>
              {entidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} (NIF {e.nif})
                </option>
              ))}
            </Select>
            <Input
              label="Título / objecto"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Contrato de formação 2026"
            />
            <Input
              label="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Data de início"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
              <Input
                label="Data de fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            {error ? <Alert variant="error">{error}</Alert> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "A criar…" : "Criar contrato"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
