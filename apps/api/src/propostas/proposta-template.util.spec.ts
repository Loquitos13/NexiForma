import { buildPropostaHtmlDocument, renderTextoPropostaHtml } from "./proposta-html.util";
import {
  DEFAULTS_PROPOSTA_TEMPLATE,
  resolverConteudoProposta,
  resolverConteudoPropostaDocumento,
} from "./proposta-template.util";

describe("proposta-template.util", () => {
  it("usa padrão do tenant quando proposta não tem override", () => {
    const r = resolverConteudoProposta(
      {
        subtitulo: null,
        apresentacaoEmpresa: null,
        enquadramento: null,
        objetivos: "Objectivo custom",
        conteudosProgramaticos: null,
        metodologia: null,
        destinatarios: null,
        duracaoTexto: null,
        localTexto: null,
        beneficios: null,
        condicoesComerciais: null,
        porqueEscolher: null,
        proximosPassos: null,
      },
      {
        ...DEFAULTS_PROPOSTA_TEMPLATE,
        validadeDiasPadrao: 30,
        nomeContacto: null,
        emailContacto: null,
        telefoneContacto: null,
        website: null,
      },
    );
    expect(r.objetivos).toBe("Objectivo custom");
    expect(r.enquadramento).toContain("crescente exigência");
    expect(r.apresentacaoEmpresa).toContain("formação profissional");
  });
});

describe("resolverConteudoPropostaDocumento", () => {
  it("não usa padrão do tenant - só texto da proposta", () => {
    const r = resolverConteudoPropostaDocumento(
      {
        subtitulo: null,
        apresentacaoEmpresa: null,
        enquadramento: null,
        objetivos: "Objectivo custom",
        conteudosProgramaticos: null,
        metodologia: null,
        destinatarios: null,
        duracaoTexto: null,
        localTexto: null,
        beneficios: null,
        condicoesComerciais: null,
        porqueEscolher: null,
        proximosPassos: null,
      },
      {
        ...DEFAULTS_PROPOSTA_TEMPLATE,
        validadeDiasPadrao: 30,
        nomeContacto: null,
        emailContacto: null,
        telefoneContacto: null,
        website: null,
      },
    );
    expect(r.objetivos).toBe("Objectivo custom");
    expect(r.enquadramento).toBeNull();
    expect(r.apresentacaoEmpresa).toBeNull();
  });
});

describe("buildPropostaHtmlDocument", () => {
  it("renumera secções quando campos intermédios estão vazios", () => {
    const base = {
      codigo: "P-001",
      titulo: "Formação Teste",
      subtitulo: null,
      descricao: null,
      moeda: "EUR",
      valorCentavos: 10000,
      validadeAte: null,
      createdAt: new Date("2026-01-15"),
      tenant: { legalName: "Tenant Lda", nif: "123456789" },
      entidadeCliente: { nome: "Cliente SA", nif: "987654321", email: null },
      conteudo: {
        subtitulo: null,
        apresentacaoEmpresa: null,
        enquadramento: "Texto enquadramento",
        objetivos: null,
        conteudosProgramaticos: "Conteúdos",
        metodologia: null,
        destinatarios: null,
        duracaoTexto: null,
        localTexto: null,
        beneficios: null,
        condicoesComerciais: null,
        porqueEscolher: null,
        proximosPassos: null,
      },
      config: {
        ...DEFAULTS_PROPOSTA_TEMPLATE,
        validadeDiasPadrao: 30,
        nomeContacto: null,
        emailContacto: null,
        telefoneContacto: null,
        website: null,
      },
    };
    const { html } = buildPropostaHtmlDocument(base);
    expect(html).toContain('<span class="num">1.</span> Enquadramento');
    expect(html).toContain('<span class="num">2.</span> Conteúdos Programáticos');
    expect(html).toContain('<span class="num">3.</span> Investimento');
    expect(html).not.toContain('<span class="num">9.</span>');
  });
});

describe("renderTextoPropostaHtml", () => {
  it("converte linhas com bullet em lista HTML", () => {
    const html = renderTextoPropostaHtml("- Item A\n- Item B");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>Item A</li>");
    expect(html).toContain("<li>Item B</li>");
  });
});
