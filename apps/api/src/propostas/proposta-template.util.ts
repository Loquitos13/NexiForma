export type ConfigPropostaTemplate = {
  apresentacaoEmpresa: string | null;
  enquadramentoPadrao: string | null;
  objetivosPadrao: string | null;
  conteudosProgramaticosPadrao: string | null;
  metodologiaPadrao: string | null;
  destinatariosPadrao: string | null;
  duracaoTextoPadrao: string | null;
  localTextoPadrao: string | null;
  beneficiosPadrao: string | null;
  condicoesComerciaisPadrao: string | null;
  porqueEscolherPadrao: string | null;
  proximosPassosPadrao: string | null;
  validadeDiasPadrao: number;
  nomeContacto: string | null;
  emailContacto: string | null;
  telefoneContacto: string | null;
  website: string | null;
};

export type PropostaConteudoCampos = {
  subtitulo: string | null;
  apresentacaoEmpresa: string | null;
  enquadramento: string | null;
  objetivos: string | null;
  conteudosProgramaticos: string | null;
  metodologia: string | null;
  destinatarios: string | null;
  duracaoTexto: string | null;
  localTexto: string | null;
  beneficios: string | null;
  condicoesComerciais: string | null;
  porqueEscolher: string | null;
  proximosPassos: string | null;
};

export type PropostaConteudoResolvido = PropostaConteudoCampos & {
  contacto: {
    nome: string | null;
    email: string | null;
    telefone: string | null;
    website: string | null;
  };
};

function pick(proposta: string | null | undefined, padrao: string | null | undefined): string | null {
  const p = proposta?.trim();
  if (p) return p;
  const d = padrao?.trim();
  return d || null;
}

function onlyProposta(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v || null;
}

export function resolverConteudoProposta(
  proposta: PropostaConteudoCampos,
  config: ConfigPropostaTemplate,
): PropostaConteudoResolvido {
  return {
    subtitulo: proposta.subtitulo?.trim() || null,
    apresentacaoEmpresa: pick(proposta.apresentacaoEmpresa, config.apresentacaoEmpresa),
    enquadramento: pick(proposta.enquadramento, config.enquadramentoPadrao),
    objetivos: pick(proposta.objetivos, config.objetivosPadrao),
    conteudosProgramaticos: pick(
      proposta.conteudosProgramaticos,
      config.conteudosProgramaticosPadrao,
    ),
    metodologia: pick(proposta.metodologia, config.metodologiaPadrao),
    destinatarios: pick(proposta.destinatarios, config.destinatariosPadrao),
    duracaoTexto: pick(proposta.duracaoTexto, config.duracaoTextoPadrao),
    localTexto: pick(proposta.localTexto, config.localTextoPadrao),
    beneficios: pick(proposta.beneficios, config.beneficiosPadrao),
    condicoesComerciais: pick(proposta.condicoesComerciais, config.condicoesComerciaisPadrao),
    porqueEscolher: pick(proposta.porqueEscolher, config.porqueEscolherPadrao),
    proximosPassos: pick(proposta.proximosPassos, config.proximosPassosPadrao),
    contacto: {
      nome: config.nomeContacto,
      email: config.emailContacto,
      telefone: config.telefoneContacto,
      website: config.website,
    },
  };
}

/** Conteúdo efectivo para documento - só campos preenchidos na proposta (sem fallback ao padrão). */
export function resolverConteudoPropostaDocumento(
  proposta: PropostaConteudoCampos,
  config: ConfigPropostaTemplate,
): PropostaConteudoResolvido {
  return {
    subtitulo: onlyProposta(proposta.subtitulo),
    apresentacaoEmpresa: onlyProposta(proposta.apresentacaoEmpresa),
    enquadramento: onlyProposta(proposta.enquadramento),
    objetivos: onlyProposta(proposta.objetivos),
    conteudosProgramaticos: onlyProposta(proposta.conteudosProgramaticos),
    metodologia: onlyProposta(proposta.metodologia),
    destinatarios: onlyProposta(proposta.destinatarios),
    duracaoTexto: onlyProposta(proposta.duracaoTexto),
    localTexto: onlyProposta(proposta.localTexto),
    beneficios: onlyProposta(proposta.beneficios),
    condicoesComerciais: onlyProposta(proposta.condicoesComerciais),
    porqueEscolher: onlyProposta(proposta.porqueEscolher),
    proximosPassos: onlyProposta(proposta.proximosPassos),
    contacto: {
      nome: config.nomeContacto,
      email: config.emailContacto,
      telefone: config.telefoneContacto,
      website: config.website,
    },
  };
}

export function calcularValidadeProposta(
  validadeAte: Date | null,
  validadeDiasPadrao: number,
  createdAt: Date,
): Date | null {
  if (validadeAte) return validadeAte;
  const dias = validadeDiasPadrao > 0 ? validadeDiasPadrao : 30;
  const d = new Date(createdAt);
  d.setDate(d.getDate() + dias);
  return d;
}

export function extractPropostaConteudo(row: {
  subtitulo?: string | null;
  apresentacaoEmpresa?: string | null;
  enquadramento?: string | null;
  objetivos?: string | null;
  conteudosProgramaticos?: string | null;
  metodologia?: string | null;
  destinatarios?: string | null;
  duracaoTexto?: string | null;
  localTexto?: string | null;
  beneficios?: string | null;
  condicoesComerciais?: string | null;
  porqueEscolher?: string | null;
  proximosPassos?: string | null;
}): PropostaConteudoCampos {
  return {
    subtitulo: row.subtitulo ?? null,
    apresentacaoEmpresa: row.apresentacaoEmpresa ?? null,
    enquadramento: row.enquadramento ?? null,
    objetivos: row.objetivos ?? null,
    conteudosProgramaticos: row.conteudosProgramaticos ?? null,
    metodologia: row.metodologia ?? null,
    destinatarios: row.destinatarios ?? null,
    duracaoTexto: row.duracaoTexto ?? null,
    localTexto: row.localTexto ?? null,
    beneficios: row.beneficios ?? null,
    condicoesComerciais: row.condicoesComerciais ?? null,
    porqueEscolher: row.porqueEscolher ?? null,
    proximosPassos: row.proximosPassos ?? null,
  };
}

export function configRowToTemplate(row: {
  apresentacaoEmpresa: string | null;
  enquadramentoPadrao: string | null;
  objetivosPadrao: string | null;
  conteudosProgramaticosPadrao: string | null;
  metodologiaPadrao: string | null;
  destinatariosPadrao: string | null;
  duracaoTextoPadrao: string | null;
  localTextoPadrao: string | null;
  beneficiosPadrao: string | null;
  condicoesComerciaisPadrao: string | null;
  porqueEscolherPadrao: string | null;
  proximosPassosPadrao: string | null;
  validadeDiasPadrao: number;
  nomeContacto: string | null;
  emailContacto: string | null;
  telefoneContacto: string | null;
  website: string | null;
}): ConfigPropostaTemplate {
  return {
    apresentacaoEmpresa: row.apresentacaoEmpresa,
    enquadramentoPadrao: row.enquadramentoPadrao,
    objetivosPadrao: row.objetivosPadrao,
    conteudosProgramaticosPadrao: row.conteudosProgramaticosPadrao,
    metodologiaPadrao: row.metodologiaPadrao,
    destinatariosPadrao: row.destinatariosPadrao,
    duracaoTextoPadrao: row.duracaoTextoPadrao,
    localTextoPadrao: row.localTextoPadrao,
    beneficiosPadrao: row.beneficiosPadrao,
    condicoesComerciaisPadrao: row.condicoesComerciaisPadrao,
    porqueEscolherPadrao: row.porqueEscolherPadrao,
    proximosPassosPadrao: row.proximosPassosPadrao,
    validadeDiasPadrao: row.validadeDiasPadrao,
    nomeContacto: row.nomeContacto,
    emailContacto: row.emailContacto,
    telefoneContacto: row.telefoneContacto,
    website: row.website,
  };
}

export const DEFAULTS_PROPOSTA_TEMPLATE: Omit<
  ConfigPropostaTemplate,
  "validadeDiasPadrao" | "nomeContacto" | "emailContacto" | "telefoneContacto" | "website"
> = {
  apresentacaoEmpresa:
    "Somos uma entidade especializada em formação profissional, com experiência comprovada no desenvolvimento de competências técnicas e comportamentais em contexto empresarial.",
  enquadramentoPadrao:
    "A crescente exigência do mercado obriga as equipas a desenvolver competências que permitam prestar um melhor aconselhamento, aumentar a satisfação dos clientes e potenciar resultados comerciais.\n\nCom este objetivo apresentamos a seguinte proposta de formação.",
  objetivosPadrao:
    "- Melhorar a comunicação com o cliente\n- Identificar oportunidades de venda ética\n- Aplicar técnicas de venda consultiva\n- Aumentar a taxa de conversão\n- Fidelizar clientes através de um atendimento diferenciador",
  conteudosProgramaticosPadrao:
    "Módulo 1 – Comunicação\n- Escuta ativa\n- Linguagem positiva\n- Gestão de objeções\n\nMódulo 2 – Venda Consultiva\n- Identificação de necessidades\n- Técnicas de recomendação\n- Cross-selling e up-selling\n\nMódulo 3 – Atendimento\n- Experiência do cliente\n- Fidelização\n- Casos práticos",
  metodologiaPadrao:
    "- Exposição interactiva\n- Exercícios práticos\n- Role-play\n- Simulação de atendimento\n- Discussão de casos reais",
  destinatariosPadrao:
    "Equipas comerciais, técnicos e colaboradores de atendimento.\n\nNúmero recomendado: 8 a 20 participantes.",
  duracaoTextoPadrao: "7 horas presenciais (ou 2 sessões de 3h30).",
  localTextoPadrao:
    "Nas instalações do cliente, online ou em sala disponibilizada pela nossa empresa.",
  beneficiosPadrao:
    "- Melhoria da qualidade do atendimento\n- Maior confiança da equipa\n- Incremento das vendas\n- Aumento da satisfação dos clientes\n- Uniformização dos procedimentos comerciais",
  condicoesComerciaisPadrao:
    "- Validade da proposta: 30 dias\n- Pagamento: 30 dias após faturação\n- Personalização dos conteúdos sem custos adicionais\n- Certificação da formação quando aplicável",
  porqueEscolherPadrao:
    "- Formação adaptada à realidade do cliente\n- Casos práticos baseados no dia a dia\n- Formadores com experiência sectorial\n- Acompanhamento pós-formação",
  proximosPassosPadrao:
    "Caso esta proposta vá ao encontro das vossas expectativas, teremos todo o gosto em agendar uma reunião para definir objectivos específicos, calendarização, adaptação dos conteúdos e número de participantes.",
};
