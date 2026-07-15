import { Injectable } from "@nestjs/common";
import type {
  CrmDadosExtraidosIa,
  CrmGatilhoVendaIa,
  CrmInsightsEngine,
  CrmNotaInsightsJson,
  CrmProximoPassoIa,
} from "@nexiforma/shared";
import { CrmLlmService } from "./crm-llm.service";

export type InteraccaoTextoInput = {
  tipo: string;
  titulo?: string | null;
  contexto?: string | null;
  situacaoActual?: string | null;
  dorNecessidade?: string | null;
  orcamentoTiming?: string | null;
  decisor?: string | null;
  proximoPassoNota?: string | null;
  notasLivres?: string | null;
  entidadeNome?: string | null;
  leadNome?: string | null;
};

const SYSTEM_PROMPT = `És analista comercial B2B numa empresa de formação profissional em Portugal.
Extrai informação das notas de reunião. Responde APENAS em JSON válido com esta estrutura:
{
  "resumo_situacao": "string max 500 chars",
  "sentimento": "positivo|neutro|preocupado|urgente",
  "proximos_passos": [{"accao":"string","responsavel":"vendedor|cliente|interno","prazo_sugerido":"YYYY-MM-DD ou null","prioridade":"alta|media|baixa"}],
  "gatilhos_venda": [{"tipo":"upsell|cross_sell|renovacao|novo_servico","descricao":"string","confianca":0.0,"produto_sugerido":"string ou null"}],
  "sinais_risco": ["budget","timing","decisor_ausente","concorrencia"],
  "dados_extraidos": {"orcamento_referido_eur": null, "decisor_nome": null, "prazo_decisao": null}
}
Só inclui o que está explícito ou fortemente implícito. Se incerto, confianca baixa.`;

@Injectable()
export class CrmNotasInsightsService {
  constructor(private readonly llm: CrmLlmService) {}

  async extrair(input: InteraccaoTextoInput): Promise<{
    insights: CrmNotaInsightsJson;
    engine: CrmInsightsEngine;
  }> {
    const texto = this.montarTexto(input);
    const llmRaw = await this.llm.completeJson(SYSTEM_PROMPT, texto);
    const parsed = llmRaw ? this.normalizarLlm(llmRaw) : null;
    if (parsed) {
      return { insights: parsed, engine: "llm" };
    }
    return { insights: this.extrairLocal(input, texto), engine: "local" };
  }

  montarTexto(input: InteraccaoTextoInput): string {
    const blocos: string[] = [];
    if (input.entidadeNome) blocos.push(`Cliente: ${input.entidadeNome}`);
    if (input.leadNome) blocos.push(`Lead: ${input.leadNome}`);
    blocos.push(`Tipo: ${input.tipo}`);
    if (input.titulo?.trim()) blocos.push(`Título: ${input.titulo.trim()}`);
    if (input.contexto?.trim()) blocos.push(`Contexto:\n${input.contexto.trim()}`);
    if (input.situacaoActual?.trim()) blocos.push(`Situação actual:\n${input.situacaoActual.trim()}`);
    if (input.dorNecessidade?.trim()) blocos.push(`Dor/necessidade:\n${input.dorNecessidade.trim()}`);
    if (input.orcamentoTiming?.trim()) blocos.push(`Orçamento/timing:\n${input.orcamentoTiming.trim()}`);
    if (input.decisor?.trim()) blocos.push(`Decisor:\n${input.decisor.trim()}`);
    if (input.proximoPassoNota?.trim()) blocos.push(`Próximo passo:\n${input.proximoPassoNota.trim()}`);
    if (input.notasLivres?.trim()) blocos.push(`Notas:\n${input.notasLivres.trim()}`);
    return blocos.join("\n\n");
  }

  private extrairLocal(input: InteraccaoTextoInput, texto: string): CrmNotaInsightsJson {
    const lower = texto.toLowerCase();
    const proximosPassos: CrmProximoPassoIa[] = [];
    if (input.proximoPassoNota?.trim()) {
      proximosPassos.push({
        accao: input.proximoPassoNota.trim().slice(0, 300),
        responsavel: "vendedor",
        prazoSugerido: this.extrairData(lower),
        prioridade: /urgent|urgente|imediato/.test(lower) ? "alta" : "media",
      });
    }

    const gatilhos: CrmGatilhoVendaIa[] = [];
    if (/renov|renovação|renovacao|certific/.test(lower)) {
      gatilhos.push({
        tipo: "renovacao",
        descricao: "Sinal de renovação ou certificação mencionado na nota.",
        confianca: 0.65,
        produtoSugerido: null,
      });
    }
    if (/formação|formacao|curso|capacita/.test(lower)) {
      gatilhos.push({
        tipo: "novo_servico",
        descricao: "Interesse em formação identificado nas notas.",
        confianca: 0.6,
        produtoSugerido: null,
      });
    }
    if (/mais formandos|expandir|novo departamento|upsell/.test(lower)) {
      gatilhos.push({
        tipo: "upsell",
        descricao: "Potencial de expansão ou upsell detectado.",
        confianca: 0.55,
        produtoSugerido: null,
      });
    }

    const sinais_risco: string[] = [];
    if (/orçamento|orcamento|budget|caro|preço|preco/.test(lower)) sinais_risco.push("budget");
    if (/depois|próximo ano|proximo ano|aguardar/.test(lower)) sinais_risco.push("timing");
    if (/decisor|diretor|ceo|rh/.test(lower) && !input.decisor?.trim()) {
      sinais_risco.push("decisor_ausente");
    }
    if (/concorr|alternativa|outro fornecedor/.test(lower)) sinais_risco.push("concorrencia");

    const resumoBase =
      input.situacaoActual?.trim() ||
      input.dorNecessidade?.trim() ||
      input.contexto?.trim() ||
      texto.slice(0, 400);
    const resumo_situacao = resumoBase.slice(0, 500);

    let sentimento: CrmNotaInsightsJson["sentimento"] = "neutro";
    if (/urgent|urgente|preocup|problema|risco/.test(lower)) sentimento = "preocupado";
    else if (/positiv|interessad|avanç|avanc|aceite|entusias/.test(lower)) sentimento = "positivo";
    else if (/urgente|deadline|hoje|amanhã|amanha/.test(lower)) sentimento = "urgente";

    const dados: CrmDadosExtraidosIa = {
      orcamentoReferidoEur: this.extrairEuros(lower),
      decisorNome: input.decisor?.trim().slice(0, 120) || null,
      prazoDecisao: this.extrairData(lower),
    };

    return {
      resumo_situacao,
      sentimento,
      proximos_passos: proximosPassos,
      gatilhos_venda: gatilhos,
      sinais_risco,
      dados_extraidos: dados,
    };
  }

  private normalizarLlm(raw: unknown): CrmNotaInsightsJson | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const resumo = typeof o.resumo_situacao === "string" ? o.resumo_situacao.trim() : "";
    if (!resumo) return null;

    return {
      resumo_situacao: resumo.slice(0, 500),
      sentimento: this.parseSentimento(o.sentimento),
      proximos_passos: this.parsePassos(o.proximos_passos),
      gatilhos_venda: this.parseGatilhos(o.gatilhos_venda),
      sinais_risco: Array.isArray(o.sinais_risco)
        ? o.sinais_risco.filter((x): x is string => typeof x === "string").slice(0, 8)
        : [],
      dados_extraidos: this.parseDados(o.dados_extraidos),
    };
  }

  private parseSentimento(v: unknown): CrmNotaInsightsJson["sentimento"] {
    const s = String(v ?? "neutro").toLowerCase();
    if (s === "positivo" || s === "preocupado" || s === "urgente") return s;
    return "neutro";
  }

  private parsePassos(v: unknown): CrmProximoPassoIa[] {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((p) => ({
        accao: String(p.accao ?? "").slice(0, 300),
        responsavel: (["vendedor", "cliente", "interno"] as const).includes(
          p.responsavel as CrmProximoPassoIa["responsavel"],
        )
          ? (p.responsavel as CrmProximoPassoIa["responsavel"])
          : "vendedor",
        prazoSugerido:
          typeof p.prazo_sugerido === "string" && p.prazo_sugerido.trim()
            ? p.prazo_sugerido.trim()
            : null,
        prioridade: (["alta", "media", "baixa"] as const).includes(
          p.prioridade as CrmProximoPassoIa["prioridade"],
        )
          ? (p.prioridade as CrmProximoPassoIa["prioridade"])
          : "media",
      }))
      .filter((p) => p.accao.length > 0)
      .slice(0, 6);
  }

  private parseGatilhos(v: unknown): CrmGatilhoVendaIa[] {
    if (!Array.isArray(v)) return [];
    return v
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((g) => ({
        tipo: (["upsell", "cross_sell", "renovacao", "novo_servico"] as const).includes(
          g.tipo as CrmGatilhoVendaIa["tipo"],
        )
          ? (g.tipo as CrmGatilhoVendaIa["tipo"])
          : "novo_servico",
        descricao: String(g.descricao ?? "").slice(0, 400),
        confianca: Math.min(1, Math.max(0, Number(g.confianca) || 0.5)),
        produtoSugerido:
          typeof g.produto_sugerido === "string" && g.produto_sugerido.trim()
            ? g.produto_sugerido.trim()
            : null,
      }))
      .filter((g) => g.descricao.length > 0)
      .slice(0, 5);
  }

  private parseDados(v: unknown): CrmDadosExtraidosIa {
    if (!v || typeof v !== "object") {
      return { orcamentoReferidoEur: null, decisorNome: null, prazoDecisao: null };
    }
    const d = v as Record<string, unknown>;
    const orc = d.orcamento_referido_eur;
    return {
      orcamentoReferidoEur:
        typeof orc === "number" && Number.isFinite(orc) ? Math.round(orc) : null,
      decisorNome:
        typeof d.decisor_nome === "string" && d.decisor_nome.trim()
          ? d.decisor_nome.trim().slice(0, 120)
          : null,
      prazoDecisao:
        typeof d.prazo_decisao === "string" && d.prazo_decisao.trim()
          ? d.prazo_decisao.trim()
          : null,
    };
  }

  private extrairEuros(text: string): number | null {
    const m = text.match(/(\d[\d\s.,]*)\s*€|€\s*(\d[\d\s.,]*)/);
    if (!m) return null;
    const raw = (m[1] ?? m[2] ?? "").replace(/\s/g, "").replace(",", ".");
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  private extrairData(text: string): string | null {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso) return iso[1];
    const pt = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
    if (pt) {
      return `${pt[3]}-${pt[2].padStart(2, "0")}-${pt[1].padStart(2, "0")}`;
    }
    return null;
  }
}
