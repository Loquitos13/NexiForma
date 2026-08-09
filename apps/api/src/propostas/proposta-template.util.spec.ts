import { buildPropostaHtmlDocument, renderTextoPropostaHtml } from "./proposta-html.util";
import {
  DEFAULTS_PROPOSTA_TEMPLATE,
  resolverConteudoProposta,
  resolverConteudoPropostaDocumento,
} from "./proposta-template.util";

describe("proposta-template.util", () => {
  it("usa padrão do tenant quando proposta não tem override (resolver com fallback)", () => {
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
  it("omite campos vazios e renumera as secções preenchidas", () => {
    const { html } = buildPropostaHtmlDocument({
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
        condicoesComerciais: "Pagamento a 30 dias",
        porqueEscolher: null,
        proximosPassos: null,
      },
      // Mesmo com padrões do tenant, o documento só usa texto da proposta.
      config: {
        ...DEFAULTS_PROPOSTA_TEMPLATE,
        validadeDiasPadrao: 30,
        nomeContacto: null,
        emailContacto: null,
        telefoneContacto: null,
        website: null,
      },
    });
    expect(html).toContain('<span class="num">1.</span> Enquadramento');
    expect(html).toContain('<span class="num">2.</span> Conteúdos Programáticos');
    expect(html).toContain('<span class="num">3.</span> Investimento');
    expect(html).toContain('<span class="num">4.</span> Condições Comerciais');
    expect(html).not.toContain("Objectivos da Formação");
    expect(html).not.toContain("crescente exigência");
    expect(html).not.toContain('<span class="num">5.</span>');
  });

  it("omite apresentação e secções quando a proposta está vazia (só investimento)", () => {
    const { html } = buildPropostaHtmlDocument({
      codigo: "P-002",
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
        enquadramento: null,
        objetivos: null,
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
      config: {
        ...DEFAULTS_PROPOSTA_TEMPLATE,
        validadeDiasPadrao: 30,
        nomeContacto: null,
        emailContacto: null,
        telefoneContacto: null,
        website: null,
      },
    });
    expect(html).toContain('<span class="num">1.</span> Investimento');
    expect(html).not.toContain("Enquadramento");
    expect(html).not.toContain("class=\"apresentacao\"");
  });
});

describe("renderTextoPropostaHtml", () => {
  it("converte linhas com bullet em lista HTML", () => {
    const html = renderTextoPropostaHtml("- Item A\n- Item B");
    expect(html).toContain('<ul class="bullets">');
    expect(html).toContain("<li>Item A</li>");
    expect(html).toContain("<li>Item B</li>");
  });

  it("reconhece travessões e bullets unicode do texto padrão", () => {
    const html = renderTextoPropostaHtml("– Objectivo A\n• Objectivo B\n- Objectivo C");
    expect(html).toContain("<li>Objectivo A</li>");
    expect(html).toContain("<li>Objectivo B</li>");
    expect(html).toContain("<li>Objectivo C</li>");
  });
});
