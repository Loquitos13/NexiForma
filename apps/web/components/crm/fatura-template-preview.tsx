"use client";

export type FaturaTemplatePreviewCores = {
  headerMode?: "solid" | "gradient";
  headerFrom: string;
  headerVia: string;
  headerTo: string;
  accent: string;
  surface: string;
  border: string;
};

type Props = {
  cores: FaturaTemplatePreviewCores;
  emitenteNome?: string;
  emitenteNif?: string;
  logoUrl?: string | null;
};

function headerBackground(cores: FaturaTemplatePreviewCores): string {
  if (cores.headerMode === "solid") return cores.headerFrom;
  return `linear-gradient(135deg, ${cores.headerFrom} 0%, ${cores.headerVia} 45%, ${cores.headerTo} 100%)`;
}

/** Pré-visualização compacta do PDF da fatura (layout alinhado ao documento final). */
export function FaturaTemplatePreview({
  cores,
  emitenteNome = "A sua empresa",
  emitenteNif = "500000000",
  logoUrl,
}: Props) {
  const headerBg = headerBackground(cores);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-400">Pré-visualização</p>
      <div
        className="overflow-hidden border bg-white text-neutral-900 shadow-lg [color-scheme:light]"
        style={{ borderColor: cores.border }}
      >
        <div
          className="flex items-center justify-between gap-3 border-b px-3 py-2.5"
          style={{ borderColor: cores.border }}
        >
          <div className="min-h-8 flex items-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-8 max-w-[120px] object-contain bg-transparent"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = "none";
                  const fallback = el.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.hidden = false;
                }}
              />
            ) : null}
            <div
              className="text-[10px] font-semibold text-neutral-500"
              hidden={Boolean(logoUrl)}
            >
              Logótipo
            </div>
          </div>
          <div
            className="flex h-14 w-14 items-center justify-center border bg-white text-[8px] text-neutral-400"
            style={{ borderColor: cores.border }}
            aria-hidden
          >
            QR
          </div>
        </div>

        <div className="px-3 py-3 text-white" style={{ background: headerBg }}>
          <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-white/90">
            Fatura original
          </p>
          <p className="mt-0.5 text-lg font-bold tracking-tight">Nº 2026/1</p>
        </div>

        <div className="grid grid-cols-4 border-b border-neutral-200 text-[8px]">
          {(
            [
              ["Emissão", "07/08/2026"],
              ["Vencimento", "07/09/2026"],
              ["Moeda", "€"],
              ["ATCUD", "ABCD-1"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="border-r border-neutral-200 px-2 py-2 last:border-r-0">
              <p className="font-bold uppercase tracking-wide" style={{ color: cores.accent }}>
                {label}
              </p>
              <p className="mt-0.5 font-medium text-neutral-800">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 p-2.5">
          {(
            [
              ["De", emitenteNome, `NIF ${emitenteNif}`],
              ["Para", "Cliente Exemplo Lda", "NIF 501234567"],
            ] as const
          ).map(([label, name, nif]) => (
            <div
              key={label}
              className="border p-2"
              style={{ background: cores.surface, borderColor: cores.border }}
            >
              <p
                className="text-[8px] font-bold uppercase tracking-wide"
                style={{ color: cores.accent }}
              >
                {label}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-neutral-900">{name}</p>
              <p className="text-[9px] text-neutral-500">{nif}</p>
            </div>
          ))}
        </div>

        <div className="px-2.5 pb-2.5">
          <p
            className="mb-1 text-[8px] font-bold uppercase tracking-wide"
            style={{ color: cores.headerFrom }}
          >
            Lista de artigos
          </p>
          <table className="w-full border-collapse text-[9px]" style={{ borderColor: cores.border }}>
            <thead>
              <tr style={{ background: cores.accent, color: "#fff" }}>
                <th className="px-1.5 py-1 text-left font-bold">Descrição</th>
                <th className="px-1.5 py-1 text-right font-bold">Qtd</th>
                <th className="px-1.5 py-1 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t" style={{ borderColor: cores.surface }}>
                <td className="px-1.5 py-1.5 text-neutral-800">Formação - exemplo</td>
                <td className="px-1.5 py-1.5 text-right tabular-nums">1,00</td>
                <td className="px-1.5 py-1.5 text-right font-semibold tabular-nums">1.230,00</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t px-2.5 py-2" style={{ borderColor: cores.border }}>
          <div
            className="w-[55%] border bg-neutral-50 px-2 py-1.5"
            style={{ borderColor: cores.border }}
          >
            <p
              className="text-[8px] font-bold uppercase"
              style={{ color: cores.headerFrom }}
            >
              Resumo
            </p>
            <div className="mt-1 flex justify-between text-[9px] text-neutral-600">
              <span>Subtotal</span>
              <span>1.000,00 €</span>
            </div>
            <div
              className="mt-1 flex justify-between border-t pt-1 text-[10px] font-bold"
              style={{ borderColor: cores.border, color: cores.headerFrom }}
            >
              <span>Total</span>
              <span>1.230,00 €</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
