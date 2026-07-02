import { totaisPropostaLinhas } from "./proposta-linhas.util";
import {
  resolverConteudoPropostaDocumento,
  type ConfigPropostaTemplate,
  type PropostaConteudoCampos,
} from "./proposta-template.util";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtEuro(cents: number, moeda = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: moeda }).format(
    cents / 100,
  );
}

/** Converte texto com linhas `- item` ou `• item` em HTML. */
export function renderTextoPropostaHtml(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const parts: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      parts.push(`<ul>${listItems.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`);
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bullet = line.match(/^[-•*✔✓]\s*(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]!);
      continue;
    }
    flushList();
    parts.push(`<p>${escapeHtml(line)}</p>`);
  }
  flushList();
  return parts.join("");
}

function sectionHtml(num: number, title: string, body: string | null): string {
  if (!body?.trim()) return "";
  return `<section class="sec">
    <h2><span class="num">${num}.</span> ${escapeHtml(title)}</h2>
    <div class="body">${renderTextoPropostaHtml(body)}</div>
  </section>`;
}

const SECOES_CONTEUDO: { title: string; key: keyof Pick<
  PropostaConteudoCampos,
  | "enquadramento"
  | "objetivos"
  | "conteudosProgramaticos"
  | "metodologia"
  | "destinatarios"
  | "duracaoTexto"
  | "localTexto"
  | "beneficios"
  | "condicoesComerciais"
  | "porqueEscolher"
  | "proximosPassos"
> }[] = [
  { title: "Enquadramento", key: "enquadramento" },
  { title: "Objectivos da Formação", key: "objetivos" },
  { title: "Conteúdos Programáticos", key: "conteudosProgramaticos" },
  { title: "Metodologia", key: "metodologia" },
  { title: "Destinatários", key: "destinatarios" },
  { title: "Duração", key: "duracaoTexto" },
  { title: "Local", key: "localTexto" },
  { title: "Benefícios", key: "beneficios" },
];

const SECOES_POS_INVESTIMENTO: typeof SECOES_CONTEUDO = [
  { title: "Condições Comerciais", key: "condicoesComerciais" },
  { title: "Porque escolher a nossa formação", key: "porqueEscolher" },
  { title: "Próximos Passos", key: "proximosPassos" },
];

function buildSectionsNumeradas(
  resolvido: ReturnType<typeof resolverConteudoPropostaDocumento>,
  beforeInvestimento: typeof SECOES_CONTEUDO,
  afterInvestimento: typeof SECOES_POS_INVESTIMENTO,
): { before: string; after: string; investimentoNum: number } {
  let num = 1;
  const beforeParts: string[] = [];
  for (const s of beforeInvestimento) {
    const body = resolvido[s.key];
    const html = sectionHtml(num, s.title, body);
    if (html) {
      beforeParts.push(html);
      num++;
    }
  }
  const investimentoNum = num;
  num++;
  const afterParts: string[] = [];
  for (const s of afterInvestimento) {
    const body = resolvido[s.key];
    const html = sectionHtml(num, s.title, body);
    if (html) {
      afterParts.push(html);
      num++;
    }
  }
  return {
    before: beforeParts.join(""),
    after: afterParts.join(""),
    investimentoNum,
  };
}

export type PropostaHtmlLinha = {
  descricao: string;
  notas?: string | null;
  quantidade: number | string;
  precoUnitCentavos: number;
  taxaIva: number | string;
  valorIvaCentavos: number;
};

export type PropostaHtmlInput = {
  codigo: string;
  titulo: string;
  subtitulo?: string | null;
  descricao: string | null;
  moeda: string;
  valorCentavos: number;
  validadeAte: Date | null;
  createdAt: Date;
  tenant: { legalName: string; nif: string };
  entidadeCliente: { nome: string; nif: string; email: string | null };
  curso?: {
    designacao: string;
    codigoUfcd: string | null;
    cargaHoras: number | null;
  } | null;
  linhas?: PropostaHtmlLinha[];
  conteudo: PropostaConteudoCampos;
  config: ConfigPropostaTemplate;
};

export function buildPropostaHtmlDocument(row: PropostaHtmlInput): { html: string; filename: string } {
  const resolvido = resolverConteudoPropostaDocumento(row.conteudo, row.config);
  const { before, after, investimentoNum } = buildSectionsNumeradas(
    resolvido,
    SECOES_CONTEUDO,
    SECOES_POS_INVESTIMENTO,
  );
  const dataProposta = row.createdAt.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const validade = row.validadeAte
    ? row.validadeAte.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Conforme condições comerciais";

  const linhas = row.linhas ?? [];
  const totaisLinhas = linhas.length
    ? totaisPropostaLinhas(
        linhas.map((l) => ({
          descricao: l.descricao,
          quantidade: Number(l.quantidade),
          precoUnitCentavos: l.precoUnitCentavos,
          taxaIva: Number(l.taxaIva),
        })),
      )
    : { valorCentavos: row.valorCentavos, ivaCentavos: 0 };

  const baseCentavos = linhas.length ? totaisLinhas.valorCentavos : row.valorCentavos;
  const ivaCentavos = totaisLinhas.ivaCentavos;
  const totalCentavos = baseCentavos + ivaCentavos;

  const investimentoRows = linhas.length
    ? linhas
        .map((l) => {
          const q = Number(l.quantidade);
          const base = Math.round(q * l.precoUnitCentavos);
          const totalLinha = base + l.valorIvaCentavos;
          const notasCell = l.notas?.trim()
            ? escapeHtml(l.notas.trim())
            : `<span class="muted">–</span>`;
          return `<tr>
            <td>${escapeHtml(l.descricao)}</td>
            <td class="notas">${notasCell}</td>
            <td class="num">${fmtEuro(totalLinha, row.moeda)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td>${escapeHtml(row.titulo)}</td><td class="notas"><span class="muted">–</span></td><td class="num">${fmtEuro(row.valorCentavos, row.moeda)}</td></tr>`;

  const cursoNota = row.curso
    ? `<p class="curso-ref">Formação: ${escapeHtml(row.curso.designacao)}${row.curso.cargaHoras ? ` · ${row.curso.cargaHoras}h` : ""}${row.curso.codigoUfcd ? ` · UFCD ${escapeHtml(row.curso.codigoUfcd)}` : ""}</p>`
    : "";

  const contactoParts = [
    resolvido.contacto.nome,
    resolvido.contacto.email,
    resolvido.contacto.telefone,
    resolvido.contacto.website,
  ].filter(Boolean);

  const sections = before;

  const filename = `proposta-${row.codigo.toLowerCase()}.html`;
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Proposta ${escapeHtml(row.codigo)} – ${escapeHtml(row.titulo)}</title>
  <style>
    @page { margin: 1.8cm; }
    @media print { .no-print { display: none !important; } }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", Georgia, serif; color: #1e293b; margin: 0; padding: 2rem; line-height: 1.55; font-size: 11pt; max-width: 820px; }
    .cover { border-bottom: 3px solid #1e40af; padding-bottom: 1.25rem; margin-bottom: 1.5rem; }
    .cover h1 { font-size: 1.65rem; margin: 0 0 0.35rem; color: #1e3a8a; letter-spacing: 0.02em; text-transform: uppercase; }
    .cover .subtitle { font-size: 1.05rem; color: #334155; margin: 0 0 1rem; font-weight: 500; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.92rem; }
    .meta-grid dt { font-weight: 600; color: #64748b; margin: 0 0 0.15rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .meta-grid dd { margin: 0 0 0.75rem; }
    .apresentacao { background: #f8fafc; border-left: 4px solid #3b82f6; padding: 1rem 1.15rem; margin: 1.25rem 0 1.75rem; font-size: 0.95rem; }
    .sec { margin: 1.35rem 0; page-break-inside: avoid; }
    .sec h2 { font-size: 1rem; color: #1e40af; margin: 0 0 0.6rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem; }
    .sec h2 .num { color: #64748b; font-weight: 600; }
    .sec .body p { margin: 0.35rem 0; }
    .sec .body ul { margin: 0.4rem 0 0.6rem 1.1rem; padding: 0; }
    .sec .body li { margin: 0.25rem 0; }
    table.inv { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 10.5pt; }
    table.inv th, table.inv td { border: 1px solid #cbd5e1; padding: 0.5rem 0.65rem; text-align: left; }
    table.inv th { background: #f1f5f9; font-weight: 600; }
    table.inv td.num { text-align: right; white-space: nowrap; }
    table.inv td.notas { color: #475569; font-size: 10pt; vertical-align: top; }
    .muted { color: #94a3b8; }
    .total-box { text-align: right; margin-top: 0.75rem; font-size: 1.15rem; font-weight: 700; color: #1e40af; }
    .total-hint { font-size: 0.85rem; color: #64748b; text-align: right; }
    .curso-ref { font-size: 0.9rem; color: #475569; margin: 0.5rem 0 0; }
    footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #e2e8f0; font-size: 0.82rem; color: #64748b; }
    .no-print { margin-bottom: 1rem; }
    .no-print button { background: #2563eb; color: #fff; border: none; padding: 0.55rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>

  <header class="cover">
    <h1>Proposta Comercial</h1>
    ${resolvido.subtitulo ? `<p class="subtitle">${escapeHtml(resolvido.subtitulo)}</p>` : `<p class="subtitle">${escapeHtml(row.titulo)}</p>`}
    <dl class="meta-grid">
      <div><dt>Data</dt><dd>${escapeHtml(dataProposta)}</dd></div>
      <div><dt>Código</dt><dd>${escapeHtml(row.codigo)}</dd></div>
      <div><dt>Cliente</dt><dd>${escapeHtml(row.entidadeCliente.nome)}<br><span style="color:#64748b">NIF ${escapeHtml(row.entidadeCliente.nif)}</span></dd></div>
      <div><dt>Proponente</dt><dd>${escapeHtml(row.tenant.legalName)}<br><span style="color:#64748b">NIF ${escapeHtml(row.tenant.nif)}</span></dd></div>
      <div><dt>Validade</dt><dd>${escapeHtml(validade)}</dd></div>
      ${contactoParts.length ? `<div><dt>Contacto</dt><dd>${contactoParts.map(escapeHtml).join("<br>")}</dd></div>` : ""}
    </dl>
    ${cursoNota}
  </header>

  ${resolvido.apresentacaoEmpresa ? `<div class="apresentacao">${renderTextoPropostaHtml(resolvido.apresentacaoEmpresa)}</div>` : ""}

  ${sections}

  <section class="sec">
    <h2><span class="num">${investimentoNum}.</span> Investimento</h2>
    <table class="inv">
      <thead><tr><th>Descrição</th><th>Notas</th><th class="num">Valor</th></tr></thead>
      <tbody>${investimentoRows}</tbody>
    </table>
    ${linhas.length ? `<p class="total-hint">Subtotal s/ IVA: ${fmtEuro(baseCentavos, row.moeda)} · IVA: ${fmtEuro(ivaCentavos, row.moeda)}</p>` : ""}
    <p class="total-box">Valor total: ${fmtEuro(totalCentavos, row.moeda)}${ivaCentavos > 0 ? " (IVA incluído)" : " + IVA"}</p>
  </section>

  ${after}

  <footer>
    <p>Agradecemos a oportunidade de apresentar esta proposta e colocamo-nos à disposição para qualquer esclarecimento.</p>
    <p>${escapeHtml(row.tenant.legalName)} · ${escapeHtml(row.codigo)} · Documento gerado por NexiForma</p>
  </footer>
</body>
</html>`;

  return { html, filename };
}
