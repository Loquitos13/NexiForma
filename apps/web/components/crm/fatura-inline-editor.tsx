"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Plus, Settings, Trash2 } from "lucide-react";
import {
  AT_MOTIVO_ISENCAO_DEFAULT,
  AT_MOTIVOS_ISENCAO,
  buildFaturaQrPayload,
  formatarMotivoIsencaoAt,
  formatarMotivoIsencaoSelectOpcao,
} from "@nexiforma/shared";
import {
  calcularBaseLinhaCentavos,
  calcularValorIvaCentavos,
  formatarEurosInput,
  formatarPercentInput,
  parseEurosInput,
  parsePercentInput,
} from "@/lib/crm/fatura-calculos";
import {
  resolveMoradaCarga,
  resolveMoradaDescarga,
} from "@/lib/crm/faturacao-moradas";
import { Button, Input, Textarea } from "@/components/ui";

export type FaturaLinhaEdit = {
  key: string;
  descricao: string;
  quantidade: string;
  precoEuros: string;
  descontoPercent: string;
  taxaIva: string;
  codigoIsencaoIva: string;
};

export function novaLinhaFatura(taxaPadrao: number): FaturaLinhaEdit {
  const isento = taxaPadrao <= 0;
  return {
    key: crypto.randomUUID(),
    descricao: "",
    quantidade: "1",
    precoEuros: "0.00",
    descontoPercent: "0",
    taxaIva: String(taxaPadrao),
    codigoIsencaoIva: isento ? AT_MOTIVO_ISENCAO_DEFAULT : "",
  };
}

export function linhasFromApi(
  linhas: Array<{
    descricao: string;
    quantidade: number | string;
    precoUnitCentavos: number;
    taxaIva: number | string;
    descontoPercent?: number | string | null;
    codigoIsencaoIva?: string | null;
  }>,
  taxaPadrao: number,
): FaturaLinhaEdit[] {
  if (linhas.length === 0) return [novaLinhaFatura(taxaPadrao)];
  return linhas.map((l) => {
    const taxa = Number(l.taxaIva);
    return {
      key: crypto.randomUUID(),
      descricao: l.descricao,
      quantidade: String(Number(l.quantidade)),
      precoEuros: formatarEurosInput(l.precoUnitCentavos),
      descontoPercent: formatarPercentInput(l.descontoPercent),
      taxaIva: String(taxa),
      codigoIsencaoIva:
        l.codigoIsencaoIva?.trim() ||
        (taxa <= 0 ? AT_MOTIVO_ISENCAO_DEFAULT : ""),
    };
  });
}

/** Paleta alinhada ao mockup Figma (fatura roxa). */
const THEME = {
  gradient: "linear-gradient(135deg, #6d28d9 0%, #9333ea 45%, #6366f1 100%)",
  primary: "#7c3aed",
  primaryDark: "#5b21b6",
  tint: "#f5f3ff",
  tintBorder: "#ddd6fe",
  accentText: "#7c3aed",
  mutedText: "#6b7280",
};

function fmtQuantidade(q: number): string {
  return q.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPrecoEuros(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDataIso(iso: string | null | undefined): string {
  if (!iso?.trim()) return "-";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-PT");
}

function FaturaDateField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    try {
      el.showPicker();
    } catch {
      // Browser sem showPicker - o focus mantém o input nativo utilizável.
    }
  };

  return (
    <div className="mt-0.5 flex h-9 w-full overflow-hidden rounded-md border border-violet-200 bg-white focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-200">
      <button
        type="button"
        tabIndex={-1}
        onClick={openPicker}
        className="flex w-9 shrink-0 items-center justify-center border-r border-violet-100 text-violet-600 hover:bg-violet-50"
        aria-label="Abrir calendário"
      >
        <Calendar className="h-4 w-4 shrink-0" />
      </button>
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={openPicker}
        className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent px-2 py-1 text-sm text-neutral-900 outline-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:hidden"
      />
    </div>
  );
}

type Props = {
  editavel: boolean;
  canManageConfig: boolean;
  logoUrl?: string | null;
  emitente: {
    nomeEmpresa: string;
    moradaFiscal: string | null;
    nifEmitente: string;
    iban?: string | null;
    bicSwift?: string | null;
    emailGestor?: string | null;
    capitalSocial?: string | null;
    consRegCom?: string | null;
  };
  destNome: string;
  destNif: string;
  destMorada: string;
  /** Link para editar o cliente na ficha (não editável na fatura). */
  clienteId?: string | null;
  moradaCarga: string;
  moradaDescarga: string;
  onMoradaCarga: (v: string) => void;
  onMoradaDescarga: (v: string) => void;
  /** Ex.: FT → FATURA */
  tipoDocumento?: string;
  /** Tipo fiscal AT (FT, NC, …) para QR Code */
  tipoSerie: string;
  /** Ex.: 2026/1 */
  numeroDocumento: string;
  /** ORIGINAL | RASCUNHO */
  estadoDocumento?: string;
  codigoAtcud: string | null;
  dataEmissao: string | null;
  dataVencimento: string;
  onDataVencimento: (v: string) => void;
  linhas: FaturaLinhaEdit[];
  onLinhas: (next: FaturaLinhaEdit[]) => void;
  taxaPadrao: number;
  retencaoEuros: string;
  onRetencaoEuros: (v: string) => void;
  notas: string;
  onNotas: (v: string) => void;
  totalLiquidoCentavos: number;
  totais: { valorCentavos: number; ivaCentavos: number };
  softwareCertificado: string | null;
  hashIntegridade?: string | null;
};

export function FaturaInlineEditor({
  editavel,
  canManageConfig,
  logoUrl,
  emitente,
  destNome,
  destNif,
  destMorada,
  clienteId,
  moradaCarga,
  moradaDescarga,
  onMoradaCarga,
  onMoradaDescarga,
  tipoDocumento = "FATURA",
  tipoSerie,
  numeroDocumento,
  estadoDocumento = "ORIGINAL",
  codigoAtcud,
  dataEmissao,
  dataVencimento,
  onDataVencimento,
  linhas,
  onLinhas,
  taxaPadrao,
  retencaoEuros,
  onRetencaoEuros,
  notas,
  onNotas,
  totalLiquidoCentavos,
  totais,
  softwareCertificado,
  hashIntegridade,
}: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (editavel || !codigoAtcud || !dataEmissao) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { default: QRCode } = await import("qrcode");
        const payload = buildFaturaQrPayload({
          nifEmitente: emitente.nifEmitente,
          nifCliente: destNif,
          tipoDocumento: tipoSerie,
          dataEmissao: new Date(dataEmissao),
          identificacaoDocumento: `${tipoSerie} ${numeroDocumento}`,
          atcud: codigoAtcud,
          totalSemIvaCentavos: totais.valorCentavos,
          totalIvaCentavos: totais.ivaCentavos,
          hashIntegridade,
          softwareCertificado,
        });
        const url = await QRCode.toDataURL(payload, { width: 140, margin: 1 });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    codigoAtcud,
    dataEmissao,
    destNif,
    editavel,
    emitente.nifEmitente,
    hashIntegridade,
    numeroDocumento,
    softwareCertificado,
    tipoSerie,
    totais.ivaCentavos,
    totais.valorCentavos,
  ]);

  const linhasCalc = linhas
    .filter((l) => l.descricao.trim())
    .map((l) => {
      const q = Number.parseFloat(l.quantidade.replace(",", ".")) || 0;
      const preco = parseEurosInput(l.precoEuros);
      const desconto = parsePercentInput(l.descontoPercent);
      const taxa = Number.parseFloat(l.taxaIva.replace(",", ".")) || 0;
      const linhaCalc = { quantidade: q, precoUnitCentavos: preco, taxaIva: taxa, descontoPercent: desconto };
      const base = calcularBaseLinhaCentavos(linhaCalc);
      const iva = calcularValorIvaCentavos(linhaCalc);
      return { ...l, q, preco, desconto, taxa, base, iva, total: base + iva };
    });

  const isencoesUsadas = new Map<string, number>();
  let refCounter = 0;
  const refPorLinha = new Map<string, number>();
  for (const l of linhasCalc) {
    if (l.taxa <= 0 && l.codigoIsencaoIva) {
      const key = l.codigoIsencaoIva.toUpperCase();
      if (!isencoesUsadas.has(key)) {
        refCounter += 1;
        isencoesUsadas.set(key, refCounter);
      }
      refPorLinha.set(l.key, isencoesUsadas.get(key)!);
    }
  }

  const resumoIva = new Map<number, { base: number; iva: number }>();
  for (const l of linhasCalc) {
    const prev = resumoIva.get(l.taxa) ?? { base: 0, iva: 0 };
    resumoIva.set(l.taxa, { base: prev.base + l.base, iva: prev.iva + l.iva });
  }

  const hashFooter = hashIntegridade?.trim().slice(0, 4) ?? "----";
  const atcudDisplay = codigoAtcud ?? (editavel ? "-" : "-");
  const moradaCargaEfectiva = resolveMoradaCarga(moradaCarga, emitente.moradaFiscal);
  const moradaDescargaEfectiva = resolveMoradaDescarga(moradaDescarga, destMorada);

  const alterarMotivoIsencao = (codigoActual: string, codigoNovo: string) => {
    const actual = codigoActual.toUpperCase();
    const novo = codigoNovo.toUpperCase();
    if (actual === novo) return;
    onLinhas(
      linhas.map((l) => {
        const taxa = Number.parseFloat(l.taxaIva.replace(",", ".")) || 0;
        if (taxa > 0) return l;
        const codigo = (l.codigoIsencaoIva.trim() || AT_MOTIVO_ISENCAO_DEFAULT).toUpperCase();
        if (codigo !== actual) return l;
        return { ...l, codigoIsencaoIva: novo };
      }),
    );
  };

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-violet-200/80 bg-white text-neutral-900 shadow-2xl shadow-violet-900/10 [color-scheme:light] print:shadow-none">
      {/* Cabeçalho gradiente - Figma */}
      <header
        className="relative px-6 py-6 sm:px-8 sm:py-7 text-white"
        style={{ background: THEME.gradient }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {logoUrl ? (
              <div className="relative mb-3 h-10 w-32">
                <Image
                  src={logoUrl}
                  alt="Logo"
                  fill
                  className="object-contain object-left brightness-0 invert"
                  unoptimized
                />
              </div>
            ) : null}
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">
              {tipoDocumento} {estadoDocumento}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              Nº {numeroDocumento}
            </h2>
            <p className="mt-1 font-mono text-sm text-white/80">{atcudDisplay}</p>
          </div>
          <div className="shrink-0">
            {codigoAtcud && !editavel ? (
              qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="QR Code - validação AT"
                  width={88}
                  height={88}
                  className="rounded-lg bg-white p-1"
                  unoptimized
                />
              ) : (
                <div
                  className="flex h-[88px] w-[88px] items-center justify-center rounded-lg bg-white text-[9px] font-medium text-violet-400"
                  aria-busy="true"
                >
                  QR…
                </div>
              )
            ) : (
              <div className="flex h-[88px] w-[88px] items-center justify-center rounded-lg border border-dashed border-white/40 bg-white/10 text-center text-[9px] text-white/70">
                {editavel ? "QR na emissão" : "QR Code"}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Metadados - fundo branco */}
      <div className="grid grid-cols-2 border-b border-neutral-200 sm:grid-cols-4">
        {[
          { label: "Data de Emissão", content: dataEmissao ? fmtDataIso(dataEmissao) : "-" },
          {
            label: "Data de Vencimento",
            content: editavel ? (
              <FaturaDateField
                id="fatura-data-vencimento"
                value={dataVencimento}
                onChange={onDataVencimento}
              />
            ) : (
              fmtDataIso(dataVencimento)
            ),
          },
          { label: "Moeda", content: "€ (Euro)" },
          { label: "ATCUD", content: atcudDisplay },
        ].map((cell, i) => (
          <div
            key={cell.label}
            className={`border-neutral-200 px-4 py-3 ${i < 3 ? "border-r" : ""} ${i < 2 ? "border-b sm:border-b-0" : ""}`}
          >
            <label
              htmlFor={cell.label === "Data de Vencimento" && editavel ? "fatura-data-vencimento" : undefined}
              className="text-[10px] font-bold uppercase tracking-wide text-violet-600"
            >
              {cell.label}
            </label>
            <div className="mt-0.5 text-sm font-medium text-neutral-800">{cell.content}</div>
          </div>
        ))}
      </div>

      {/* De / Para - cartões */}
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: THEME.tintBorder, backgroundColor: THEME.tint }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">De</p>
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-neutral-900">{emitente.nomeEmpresa || "-"}</p>
            {emitente.moradaFiscal ? (
              <p className="whitespace-pre-line text-neutral-600">{emitente.moradaFiscal}</p>
            ) : (
              <p className="text-xs text-amber-700">
                Morada fiscal em falta.{" "}
                {canManageConfig ? (
                  <Link href="/portal/crm/faturacao" className="underline">
                    Configurar
                  </Link>
                ) : null}
              </p>
            )}
            <p className="text-neutral-600">
              <span className="text-neutral-500">NIF </span>
              {emitente.nifEmitente || "-"}
            </p>
            {emitente.capitalSocial ? (
              <p className="text-neutral-600">
                <span className="text-neutral-500">Capital social </span>
                {emitente.capitalSocial}
              </p>
            ) : null}
            {emitente.consRegCom ? (
              <p className="text-neutral-600">
                <span className="text-neutral-500">Conservatória do Registo Comercial </span>
                {emitente.consRegCom}
              </p>
            ) : null}
            {emitente.iban ? (
              <p className="font-mono text-xs text-neutral-700">IBAN {emitente.iban}</p>
            ) : null}
            {emitente.bicSwift ? (
              <p className="font-mono text-xs text-neutral-700">BIC/SWIFT {emitente.bicSwift}</p>
            ) : null}
            {emitente.emailGestor ? (
              <p className="text-neutral-600">{emitente.emailGestor}</p>
            ) : null}
            {editavel &&
            canManageConfig &&
            (!emitente.iban ||
              !emitente.bicSwift ||
              !emitente.emailGestor ||
              !emitente.capitalSocial ||
              !emitente.consRegCom) ? (
              <p className="text-xs text-amber-700">
                Dados bancários ou legais em falta.{" "}
                <Link href="/portal/crm/faturacao" className="underline">
                  Completar emitente
                </Link>
              </p>
            ) : null}
            {canManageConfig && editavel ? (
              <Link
                href="/portal/crm/faturacao"
                className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline"
              >
                <Settings className="h-3 w-3" />
                Dados emitente
              </Link>
            ) : null}
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ borderColor: THEME.tintBorder, backgroundColor: THEME.tint }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">Para</p>
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-neutral-900">{destNome || "-"}</p>
            {destMorada ? (
              <p className="whitespace-pre-line text-neutral-600">{destMorada}</p>
            ) : null}
            <p className="text-neutral-600">
              <span className="text-neutral-500">NIF </span>
              {destNif || "-"}
            </p>
            {editavel && clienteId ? (
              <Link
                href={`/portal/clientes/${clienteId}`}
                className="inline-block pt-1 text-xs text-violet-700 hover:underline"
              >
                Editar na ficha do cliente
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Moradas de transporte */}
      <div className="grid gap-4 px-5 pb-2 sm:grid-cols-2 sm:px-6">
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: THEME.tintBorder, backgroundColor: THEME.tint }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">
            Morada de carga
          </p>
          {editavel ? (
            <div className="space-y-1">
              <Textarea
                value={moradaCarga}
                onChange={(e) => onMoradaCarga(e.target.value)}
                rows={2}
                className="border-violet-200 bg-white text-neutral-900"
              />
              {!moradaCarga.trim() && emitente.moradaFiscal ? (
                <p className="text-xs text-neutral-500">
                  Omissão: {emitente.moradaFiscal}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm text-neutral-700">
              {moradaCargaEfectiva || "-"}
            </p>
          )}
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ borderColor: THEME.tintBorder, backgroundColor: THEME.tint }}
        >
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-600">
            Morada de descarga
          </p>
          {editavel ? (
            <div className="space-y-1">
              <Textarea
                value={moradaDescarga}
                onChange={(e) => onMoradaDescarga(e.target.value)}
                rows={2}
                className="border-violet-200 bg-white text-neutral-900"
              />
              {!moradaDescarga.trim() && destMorada ? (
                <p className="text-xs text-neutral-500">Omissão: {destMorada}</p>
              ) : null}
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm text-neutral-700">
              {moradaDescargaEfectiva || "-"}
            </p>
          )}
        </div>
      </div>

      {/* Artigos */}
      <div className="px-5 pb-4 sm:px-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">
          Lista de Artigos
        </p>
        <div className="overflow-x-auto rounded-xl border border-violet-100">
          <table className="w-full min-w-[780px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase text-white" style={{ background: THEME.primary }}>
                <th className="px-4 py-2.5">Descrição do artigo</th>
                <th className="w-[5.5rem] px-4 py-2.5 text-center">Quant.</th>
                <th className="w-[6.5rem] px-4 py-2.5 text-center">Preço</th>
                <th className="w-[5.5rem] px-4 py-2.5 text-center">Desc.</th>
                <th className="w-[6rem] px-4 py-2.5 text-center">IVA (%)</th>
                <th className="w-28 px-4 py-2.5 text-right">Total</th>
                {editavel ? <th className="w-8" /> : null}
              </tr>
            </thead>
            <tbody className="bg-white">
              {linhas.map((linha, idx) => {
                const q = Number.parseFloat(linha.quantidade.replace(",", ".")) || 0;
                const preco = parseEurosInput(linha.precoEuros);
                const desconto = parsePercentInput(linha.descontoPercent);
                const taxa = Number.parseFloat(linha.taxaIva.replace(",", ".")) || 0;
                const linhaCalc = {
                  quantidade: q,
                  precoUnitCentavos: preco,
                  taxaIva: taxa,
                  descontoPercent: desconto,
                };
                const base = calcularBaseLinhaCentavos(linhaCalc);
                const iva = calcularValorIvaCentavos(linhaCalc);
                const total = base + iva;
                const ref = refPorLinha.get(linha.key);

                const patch = (p: Partial<FaturaLinhaEdit>) => {
                  const next = [...linhas];
                  next[idx] = { ...linha, ...p };
                  if (p.taxaIva !== undefined) {
                    const t = Number.parseFloat(p.taxaIva.replace(",", ".")) || 0;
                    if (t <= 0 && !next[idx].codigoIsencaoIva) {
                      next[idx].codigoIsencaoIva = AT_MOTIVO_ISENCAO_DEFAULT;
                    }
                    if (t > 0) next[idx].codigoIsencaoIva = "";
                  }
                  onLinhas(next);
                };

                return (
                  <tr key={linha.key} className="border-t border-violet-50 align-top">
                    <td className="px-4 py-3">
                      {editavel ? (
                        <Input
                          value={linha.descricao}
                          onChange={(e) => patch({ descricao: e.target.value })}
                          className="border-violet-200 bg-white text-neutral-900"
                          placeholder="Descrição do artigo / serviço"
                        />
                      ) : (
                        <p className="font-medium text-neutral-900">{linha.descricao}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {editavel ? (
                        <Input
                          value={linha.quantidade}
                          onChange={(e) => patch({ quantidade: e.target.value })}
                          className="mx-auto w-[4.25rem] border-violet-200 bg-white text-center text-neutral-900"
                        />
                      ) : (
                        fmtQuantidade(q)
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {editavel ? (
                        <Input
                          value={linha.precoEuros}
                          onChange={(e) => patch({ precoEuros: e.target.value })}
                          className="mx-auto w-[5.25rem] border-violet-200 bg-white text-center text-neutral-900"
                        />
                      ) : (
                        fmtPrecoEuros(preco)
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {editavel ? (
                        <Input
                          value={linha.descontoPercent}
                          onChange={(e) => patch({ descontoPercent: e.target.value })}
                          className="mx-auto w-[4.25rem] border-violet-200 bg-white text-center text-neutral-900"
                          aria-label="Desconto (%)"
                        />
                      ) : (
                        <span className={desconto > 0 ? "text-neutral-700" : "text-neutral-400"}>
                          {desconto.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {editavel ? (
                        <Input
                          value={linha.taxaIva}
                          onChange={(e) => patch({ taxaIva: e.target.value })}
                          className="mx-auto w-[4.25rem] border-violet-200 bg-white text-center text-neutral-900"
                        />
                      ) : (
                        <>
                          {taxa.toFixed(2)}
                          {ref ? (
                            <>
                              {" "}
                              <sup className="text-violet-600">({ref})</sup>
                            </>
                          ) : null}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {fmtPrecoEuros(total)}
                    </td>
                    {editavel ? (
                      <td className="px-1 py-3">
                        <button
                          type="button"
                          className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => onLinhas(linhas.filter((_, i) => i !== idx))}
                          disabled={linhas.length <= 1}
                          title="Remover linha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editavel ? (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 border-violet-200 text-violet-800 hover:bg-violet-50"
            onClick={() => onLinhas([...linhas, novaLinhaFatura(taxaPadrao)])}
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar artigo
          </Button>
        ) : null}
      </div>

      {/* Enquadramento IVA - cartão full width */}
      {isencoesUsadas.size > 0 ? (
        <div className="mx-5 mb-4 rounded-xl border px-4 py-3 sm:mx-6" style={{ borderColor: THEME.tintBorder, backgroundColor: THEME.tint }}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">
            Condições de Enquadramento de IVA
          </p>
          <ul className="space-y-2 text-sm text-neutral-700">
            {[...isencoesUsadas.entries()]
              .sort((a, b) => a[1] - b[1])
              .map(([code, ref]) => (
                <li key={code} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-violet-700">({ref})</span>
                  {editavel ? (
                    <select
                      value={code}
                      onChange={(e) => alterarMotivoIsencao(code, e.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-violet-200 bg-white px-2 py-1.5 text-xs text-violet-900"
                      aria-label={`Motivo de isenção (${ref})`}
                    >
                      {AT_MOTIVOS_ISENCAO.map((c) => (
                        <option key={c} value={c}>
                          {formatarMotivoIsencaoSelectOpcao(c)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    formatarMotivoIsencaoAt(code)
                  )}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {/* Rodapé: notas + resumo */}
      <div className="grid gap-4 border-t border-violet-100 px-5 py-5 sm:grid-cols-2 sm:px-6">
        {editavel ? (
          <div className="space-y-3 text-sm">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Retenção na fonte (€)</label>
              <Input
                value={retencaoEuros}
                onChange={(e) => onRetencaoEuros(e.target.value)}
                className="max-w-[140px] border-violet-200 bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Notas (opcional)</label>
              <Textarea
                value={notas}
                onChange={(e) => onNotas(e.target.value)}
                rows={2}
                className="border-violet-200 bg-white"
              />
            </div>
          </div>
        ) : notas ? (
          <p className="text-sm text-neutral-600">
            <strong>Notas:</strong> {notas}
          </p>
        ) : (
          <div />
        )}

        <div
          className="rounded-xl border p-4 sm:ml-auto sm:max-w-sm"
          style={{ borderColor: THEME.tintBorder, backgroundColor: "#fafafa" }}
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-violet-700">Resumo</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-600">Subtotal da Fatura</span>
              <span className="font-medium tabular-nums">{fmtPrecoEuros(totais.valorCentavos)} €</span>
            </div>
            {[...resumoIva.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([taxa, vals]) => (
                <div key={taxa} className="flex justify-between gap-4">
                  <span className="text-neutral-600">
                    IVA {taxa.toFixed(2).replace(".", ",")}% (Incidência: {fmtPrecoEuros(vals.base)})
                  </span>
                  <span className="tabular-nums">{fmtPrecoEuros(vals.iva)} €</span>
                </div>
              ))}
            <div className="flex justify-between gap-4 border-t border-violet-200 pt-3">
              <span className="font-bold text-violet-800">Total da Fatura</span>
              <span className="text-xl font-bold tabular-nums text-violet-700">
                {fmtPrecoEuros(totalLiquidoCentavos)} €
              </span>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-violet-100 bg-violet-50/40 px-6 py-2.5 text-center text-[10px] text-neutral-500">
        {hashFooter} - Processado por Programa Certificado n.º {softwareCertificado?.trim() || "-"}/AT
      </footer>
    </article>
  );
}
