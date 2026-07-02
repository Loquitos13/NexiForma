"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import {
  calcularBaseLinhaCentavos,
  calcularTotaisLinhas,
  calcularValorIvaCentavos,
  formatarEurosInput,
  parseEurosInput,
} from "@/lib/crm/fatura-calculos";
import { fmtEuro } from "@/lib/crm/shared";

export type PropostaLinhaForm = {
  key: string;
  descricao: string;
  notas: string;
  quantidade: string;
  precoEuros: string;
  taxaIva: string;
};

export function novaPropostaLinha(taxaPadrao = 23): PropostaLinhaForm {
  return {
    key: crypto.randomUUID(),
    descricao: "",
    notas: "",
    quantidade: "1",
    precoEuros: "0.00",
    taxaIva: String(taxaPadrao),
  };
}

export function linhasPropostaParaApi(linhas: PropostaLinhaForm[]) {
  return linhas
    .filter((l) => l.descricao.trim())
    .map((l) => ({
      descricao: l.descricao.trim(),
      notas: l.notas.trim() || null,
      quantidade: Number.parseFloat(l.quantidade.replace(",", ".")) || 1,
      precoUnitCentavos: parseEurosInput(l.precoEuros),
      taxaIva: Number.parseFloat(l.taxaIva.replace(",", ".")) || 0,
    }));
}

type Props = {
  linhas: PropostaLinhaForm[];
  onChange: (linhas: PropostaLinhaForm[]) => void;
  taxaPadrao?: number;
  /** Layout em cartões – ideal para modais estreitos */
  compact?: boolean;
  /** Oculta o cabeçalho interno quando a secção pai já tem título */
  hideHeader?: boolean;
  readOnly?: boolean;
};

function updateLinha(
  linhas: PropostaLinhaForm[],
  idx: number,
  patch: Partial<PropostaLinhaForm>,
): PropostaLinhaForm[] {
  const next = [...linhas];
  next[idx] = { ...linhas[idx], ...patch };
  return next;
}

export function PropostaLinhasEditor({
  linhas,
  onChange,
  taxaPadrao = 23,
  compact = false,
  hideHeader = false,
  readOnly = false,
}: Props) {
  const parsed = linhasPropostaParaApi(linhas);
  const totais = parsed.length ? calcularTotaisLinhas(parsed) : { valorCentavos: 0, ivaCentavos: 0 };
  const totalComIva = totais.valorCentavos + totais.ivaCentavos;

  return (
    <div className="min-w-0 w-full max-w-full space-y-3">
      {!hideHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-200">Itens (opcional)</p>
          <p className="text-xs text-slate-500">Como numa fatura: preço s/ IVA + IVA por linha</p>
        </div>
      ) : null}

      {compact ? (
        <div className="space-y-3">
          {linhas.map((linha, idx) => {
            const q = Number.parseFloat(linha.quantidade.replace(",", ".")) || 0;
            const preco = parseEurosInput(linha.precoEuros);
            const taxa = Number.parseFloat(linha.taxaIva.replace(",", ".")) || 0;
            const base = calcularBaseLinhaCentavos({ quantidade: q, precoUnitCentavos: preco, taxaIva: taxa });
            const iva = calcularValorIvaCentavos({ quantidade: q, precoUnitCentavos: preco, taxaIva: taxa });
            const total = base + iva;

            return (
              <div
                key={linha.key}
                className="rounded-lg border border-slate-700/40 bg-slate-800/20 p-3 space-y-3"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <div className="min-w-0 flex-1 space-y-3">
                    <Textarea
                      label="Produto / serviço"
                      value={linha.descricao}
                      onChange={(e) => onChange(updateLinha(linhas, idx, { descricao: e.target.value }))}
                      placeholder="Ex.: Formação presencial (7h)"
                      rows={2}
                      className="text-base leading-snug min-h-[3.25rem]"
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                    <Textarea
                      label="Notas do item (opcional)"
                      value={linha.notas}
                      onChange={(e) => onChange(updateLinha(linhas, idx, { notas: e.target.value }))}
                      placeholder="Detalhes adicionais – coluna Notas no PDF"
                      rows={2}
                      className="text-sm"
                      readOnly={readOnly}
                      disabled={readOnly}
                    />
                  </div>
                  {!readOnly ? (
                  <button
                    type="button"
                    className="mt-7 rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30 shrink-0"
                    onClick={() => onChange(linhas.filter((_, i) => i !== idx))}
                    disabled={linhas.length <= 1}
                    title="Remover linha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Input
                    label="Qtd."
                    value={linha.quantidade}
                    onChange={(e) => onChange(updateLinha(linhas, idx, { quantidade: e.target.value }))}
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                  <Input
                    label="Preço s/ IVA (€)"
                    value={linha.precoEuros}
                    onChange={(e) => onChange(updateLinha(linhas, idx, { precoEuros: e.target.value }))}
                    placeholder="0.00"
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                  <Input
                    label="IVA %"
                    value={linha.taxaIva}
                    onChange={(e) => onChange(updateLinha(linhas, idx, { taxaIva: e.target.value }))}
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </div>
                <p className="text-xs text-slate-400 text-right tabular-nums">
                  Base {fmtEuro(base)} · IVA {fmtEuro(iva)} ·{" "}
                  <span className="font-medium text-slate-200">Total {fmtEuro(total)}</span>
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-700/40">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700/40 bg-slate-800/40 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-semibold min-w-[220px]">Produto / serviço</th>
                <th className="px-2 py-2 font-semibold min-w-[160px]">Notas</th>
                <th className="px-2 py-2 font-semibold text-right w-16">Qtd.</th>
                <th className="px-2 py-2 font-semibold text-right w-24">Preço s/ IVA</th>
                <th className="px-2 py-2 font-semibold text-right w-24">Base</th>
                <th className="px-2 py-2 font-semibold text-right w-16">IVA %</th>
                <th className="px-2 py-2 font-semibold text-right w-24">IVA</th>
                <th className="px-2 py-2 font-semibold text-right w-28">Total c/ IVA</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, idx) => {
                const q = Number.parseFloat(linha.quantidade.replace(",", ".")) || 0;
                const preco = parseEurosInput(linha.precoEuros);
                const taxa = Number.parseFloat(linha.taxaIva.replace(",", ".")) || 0;
                const base = calcularBaseLinhaCentavos({ quantidade: q, precoUnitCentavos: preco, taxaIva: taxa });
                const iva = calcularValorIvaCentavos({ quantidade: q, precoUnitCentavos: preco, taxaIva: taxa });
                const total = base + iva;

                return (
                  <tr key={linha.key} className="border-b border-slate-800/60 align-top">
                    <td className="px-2 py-2 min-w-[220px]">
                      <Textarea
                        value={linha.descricao}
                        onChange={(e) => onChange(updateLinha(linhas, idx, { descricao: e.target.value }))}
                        placeholder="Ex.: Subscrição Mensal Bronze"
                        rows={2}
                        className="text-base leading-snug min-h-[3.25rem] w-full min-w-[200px]"
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[160px]">
                      <Textarea
                        value={linha.notas}
                        onChange={(e) => onChange(updateLinha(linhas, idx, { notas: e.target.value }))}
                        placeholder="Opcional – coluna Notas no PDF"
                        rows={2}
                        className="text-sm w-full min-w-[140px]"
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={linha.quantidade}
                        onChange={(e) => onChange(updateLinha(linhas, idx, { quantidade: e.target.value }))}
                        className="text-right"
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={linha.precoEuros}
                        onChange={(e) => onChange(updateLinha(linhas, idx, { precoEuros: e.target.value }))}
                        className="text-right"
                        placeholder="0.00"
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400">{fmtEuro(base)}</td>
                    <td className="px-2 py-2">
                      <Input
                        value={linha.taxaIva}
                        onChange={(e) => onChange(updateLinha(linhas, idx, { taxaIva: e.target.value }))}
                        className="text-right"
                        readOnly={readOnly}
                        disabled={readOnly}
                      />
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-400">{fmtEuro(iva)}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-medium text-slate-200">{fmtEuro(total)}</td>
                    <td className="px-1 py-2">
                      {!readOnly ? (
                      <button
                        type="button"
                        className="rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                        onClick={() => onChange(linhas.filter((_, i) => i !== idx))}
                        disabled={linhas.length <= 1}
                        title="Remover linha"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!readOnly ? (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => onChange([...linhas, novaPropostaLinha(taxaPadrao)])}
      >
        <Plus className="h-3.5 w-3.5" />
        Adicionar linha
      </Button>
      ) : null}
      {parsed.length > 0 ? (
        <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-4 py-3 text-sm text-slate-300 space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Total s/ IVA</span>
            <span className="tabular-nums">{fmtEuro(totais.valorCentavos)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">IVA</span>
            <span className="tabular-nums">{fmtEuro(totais.ivaCentavos)}</span>
          </div>
          <div className="flex justify-between gap-4 font-semibold text-teal-300 border-t border-slate-700/40 pt-2">
            <span>Total c/ IVA</span>
            <span className="tabular-nums">{fmtEuro(totalComIva)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { formatarEurosInput };
