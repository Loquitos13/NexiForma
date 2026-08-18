/** Módulo operacional ao qual pertencem templates e variáveis. */
export type TemplateModulo = "geral" | "formacao" | "crm" | "faturacao";

export type TemplateVariableDef = {
  /** Chave usada no texto: {{formando.nome_completo}} */
  key: string;
  label: string;
  grupo: string;
  exemplo?: string;
};

export type TemplateTypeDef = {
  id: string;
  label: string;
  descricao?: string;
  /** Conteúdo inicial sugerido (HTML ou texto). */
  conteudoDefault?: string;
};

export const TEMPLATE_MODULO_LABELS: Record<TemplateModulo, string> = {
  geral: "Geral",
  formacao: "Formação",
  crm: "CRM",
  faturacao: "Faturação",
};

/** Variáveis disponíveis por módulo (inseríveis na textarea). */
export const TEMPLATE_VARIABLES: Record<TemplateModulo, TemplateVariableDef[]> = {
  geral: [
    { key: "entidade.nome_legal", label: "Nome legal da entidade", grupo: "Entidade", exemplo: "FormaFuturo Lda." },
    { key: "entidade.nome_comercial", label: "Nome comercial da entidade", grupo: "Entidade" },
    { key: "entidade.nif", label: "NIF da entidade", grupo: "Entidade", exemplo: "501234567" },
    { key: "entidade.morada", label: "Morada da entidade", grupo: "Entidade" },
    { key: "entidade.email", label: "Email da entidade", grupo: "Entidade" },
    { key: "entidade.telefone", label: "Telefone da entidade", grupo: "Entidade" },
    { key: "local.data_extenso", label: "Local e data por extenso", grupo: "Local", exemplo: "Santa Maria da Feira, 11 de março de 2026" },
    { key: "data.hoje_extenso", label: "Data de hoje por extenso", grupo: "Local" },
  ],
  formacao: [
    { key: "formando.nome_completo", label: "Nome completo do formando", grupo: "Formando", exemplo: "Maria Silva" },
    { key: "formando.nif", label: "NIF do formando", grupo: "Formando" },
    { key: "formando.data_nascimento", label: "Data de nascimento", grupo: "Formando", exemplo: "15/03/1990" },
    { key: "formando.tipo_documento", label: "Tipo de documento de identificação", grupo: "Formando", exemplo: "CC" },
    { key: "formando.numero_identificacao", label: "N.º identificação (com CC)", grupo: "Formando", exemplo: "12345678 0 ZX3" },
    { key: "formando.validade_identificacao", label: "Validade do documento de identificação", grupo: "Formando", exemplo: "12/08/2030" },
    { key: "formando.nacionalidade", label: "Nacionalidade", grupo: "Formando", exemplo: "PT" },
    { key: "formando.habilitacao_literaria", label: "Habilitações literárias", grupo: "Formando" },
    { key: "formando.email", label: "Email do formando", grupo: "Formando" },
    { key: "formando.email_presenca", label: "Email de presença (reuniões)", grupo: "Formando" },
    { key: "formando.telefone", label: "Telefone do formando", grupo: "Formando" },
    { key: "formando.morada", label: "Morada do formando", grupo: "Formando" },
    { key: "formador.nome_completo", label: "Nome completo do formador", grupo: "Formador" },
    { key: "formador.nif", label: "NIF do formador", grupo: "Formador" },
    { key: "formador.email", label: "Email do formador", grupo: "Formador" },
    { key: "formador.email_presenca", label: "Email de presença do formador", grupo: "Formador" },
    { key: "formador.telefone", label: "Telefone do formador", grupo: "Formador" },
    { key: "formador.morada", label: "Morada do formador", grupo: "Formador" },
    { key: "formador.cc_numero", label: "N.º cartão de cidadão", grupo: "Formador" },
    { key: "formador.cc_validade", label: "Validade do CC", grupo: "Formador" },
    { key: "formador.ccp_numero", label: "N.º certificado de competências pedagógicas", grupo: "Formador" },
    { key: "formador.ccp_validade", label: "Validade do CCP", grupo: "Formador" },
    { key: "curso.designacao", label: "Designação do curso", grupo: "Curso / Acção", exemplo: "Técnico de Contabilidade" },
    { key: "curso.codigo_ufcd", label: "Código UFCD", grupo: "Curso / Acção" },
    { key: "curso.modalidade", label: "Modalidade (presencial, b-learning, e-learning)", grupo: "Curso / Acção" },
    { key: "acao.titulo", label: "Título da acção", grupo: "Curso / Acção" },
    { key: "acao.codigo_interno", label: "Código interno da acção", grupo: "Curso / Acção" },
    { key: "acao.data_inicio", label: "Data de início", grupo: "Curso / Acção", exemplo: "01/03/2026" },
    { key: "acao.data_fim", label: "Data de fim", grupo: "Curso / Acção", exemplo: "30/06/2026" },
    { key: "acao.carga_horas", label: "Duração total (horas)", grupo: "Curso / Acção", exemplo: "200" },
    { key: "acao.regime_ensino", label: "Regime de ensino", grupo: "Curso / Acção", exemplo: "Presencial" },
    { key: "acao.conteudos_modulos", label: "Conteúdos por módulo (teórica/prática)", grupo: "Conteúdos", exemplo: "Lista HTML gerada automaticamente" },
    { key: "turma.codigo", label: "Código da turma", grupo: "Turma" },
    { key: "turma.nome", label: "Nome da turma", grupo: "Turma" },
    { key: "entidade.nome_legal", label: "Nome legal da entidade", grupo: "Entidade" },
    { key: "entidade.nome_comercial", label: "Nome comercial da entidade", grupo: "Entidade" },
    { key: "entidade.nif", label: "NIF da entidade", grupo: "Entidade" },
    { key: "entidade.morada", label: "Morada da entidade", grupo: "Entidade" },
    { key: "entidade.email", label: "Email da entidade", grupo: "Entidade" },
    { key: "entidade.telefone", label: "Telefone da entidade", grupo: "Entidade" },
    { key: "local.data_extenso", label: "Local e data por extenso", grupo: "Local e data", exemplo: "Santa Maria da Feira, 11 de março de 2026" },
    { key: "local.cronograma", label: "Local de formação (cronograma)", grupo: "Local e data" },
    { key: "data.hoje_extenso", label: "Data de hoje por extenso", grupo: "Local e data" },
  ],
  crm: [
    { key: "cliente.nome", label: "Nome do cliente", grupo: "Cliente", exemplo: "Empresa ABC Lda." },
    { key: "cliente.nif", label: "NIF do cliente", grupo: "Cliente" },
    { key: "cliente.morada", label: "Morada do cliente", grupo: "Cliente" },
    { key: "cliente.email", label: "Email de contacto", grupo: "Cliente" },
    { key: "proposta.numero", label: "N.º da proposta", grupo: "Proposta" },
    { key: "proposta.titulo", label: "Título / objecto", grupo: "Proposta" },
    { key: "proposta.valor", label: "Valor da proposta", grupo: "Proposta", exemplo: "2.500,00 €" },
    { key: "proposta.validade", label: "Validade da proposta", grupo: "Proposta" },
    { key: "contrato.numero", label: "N.º do contrato", grupo: "Contrato" },
    { key: "contrato.data_inicio", label: "Início do contrato", grupo: "Contrato" },
    { key: "contrato.data_fim", label: "Fim do contrato", grupo: "Contrato" },
    { key: "comercial.nome", label: "Nome do comercial", grupo: "Comercial" },
    { key: "entidade.nome_legal", label: "Nome legal da entidade", grupo: "Entidade" },
    { key: "entidade.nif", label: "NIF da entidade", grupo: "Entidade" },
    { key: "local.data_extenso", label: "Local e data por extenso", grupo: "Local" },
  ],
  faturacao: [
    { key: "fatura.numero", label: "N.º da fatura", grupo: "Fatura" },
    { key: "fatura.data_emissao", label: "Data de emissão", grupo: "Fatura" },
    { key: "fatura.valor_total", label: "Valor total", grupo: "Fatura" },
    { key: "cliente.nome", label: "Nome do cliente", grupo: "Cliente" },
    { key: "cliente.nif", label: "NIF do cliente", grupo: "Cliente" },
    { key: "entidade.nome_legal", label: "Nome legal da entidade", grupo: "Entidade" },
    { key: "entidade.nif", label: "NIF da entidade", grupo: "Entidade" },
    { key: "local.data_extenso", label: "Local e data por extenso", grupo: "Local" },
  ],
};

export const TEMPLATE_TYPES: Record<TemplateModulo, TemplateTypeDef[]> = {
  geral: [],
  formacao: [
    {
      id: "inquerito",
      label: "Inquérito de avaliação",
      descricao: "Modelo de inquérito aos formandos ou formadores.",
    },
    {
      id: "declaracao_inscricao",
      label: "Declaração de inscrição",
      descricao: "Documento de inscrição na acção formativa.",
    },
    {
      id: "contrato_formacao",
      label: "Contrato de formação",
    },
    {
      id: "regulamento_formacao",
      label: "Regulamento de formação",
    },
    {
      id: "declaracao_frequencia",
      label: "Declaração de frequência",
      descricao: "Certifica a participação do formando na acção.",
      conteudoDefault: `<p>Declara-se, para os devidos efeitos, que</p>
<p><strong>{{formando.nome_completo}}</strong>, nascido(a) em <strong>{{formando.data_nascimento}}</strong>, titular do documento de identificação n.º <strong>{{formando.numero_identificacao}}</strong>, válido até <strong>{{formando.validade_identificacao}}</strong>,</p>
<p>frequentou a acção de formação <strong>{{curso.designacao}}</strong> ({{acao.codigo_interno}}), com início a <strong>{{acao.data_inicio}}</strong> e conclusão a <strong>{{acao.data_fim}}</strong>, num total de <strong>{{acao.carga_horas}}</strong> horas, em regime <strong>{{acao.regime_ensino}}</strong>.</p>
<h3>Conteúdos programáticos</h3>
{{acao.conteudos_modulos}}
<p>&nbsp;</p>
<p>{{local.data_extenso}}</p>
<p>A entidade formadora<br/><strong>{{entidade.nome_legal}}</strong><br/>NIF {{entidade.nif}}</p>`,
    },
    {
      id: "relatorio_abertura",
      label: "Relatório de acompanhamento - Abertura",
      descricao: "Incluir variável {{acao.regime_ensino}} consoante o regime.",
    },
    {
      id: "relatorio_intermedio",
      label: "Relatório de acompanhamento - Intermédio",
    },
    {
      id: "relatorio_encerramento",
      label: "Relatório de acompanhamento - Encerramento",
    },
  ],
  crm: [
    {
      id: "proposta",
      label: "Template de propostas",
      descricao: "Proposta comercial (importável ou texto com variáveis).",
      conteudoDefault: `<h1>Proposta comercial n.º {{proposta.numero}}</h1>
<p>Exmo(a). Sr(a). <strong>{{cliente.nome}}</strong><br/>NIF: {{cliente.nif}}</p>
<p>Apresentamos proposta para <strong>{{proposta.titulo}}</strong> no valor de <strong>{{proposta.valor}}</strong>, válida até {{proposta.validade}}.</p>
<p>{{local.data_extenso}}</p>
<p>{{comercial.nome}}<br/>{{entidade.nome_legal}}</p>`,
    },
    {
      id: "contrato",
      label: "Template de contratos",
      conteudoDefault: `<h1>Contrato de prestação de serviços n.º {{contrato.numero}}</h1>
<p>Entre <strong>{{entidade.nome_legal}}</strong> (NIF {{entidade.nif}}) e <strong>{{cliente.nome}}</strong> (NIF {{cliente.nif}}).</p>
<p>Vigência: {{contrato.data_inicio}} a {{contrato.data_fim}}.</p>
<p>{{local.data_extenso}}</p>`,
    },
  ],
  faturacao: [
    {
      id: "nota_credito",
      label: "Nota de crédito",
    },
    {
      id: "recibo",
      label: "Recibo",
    },
  ],
};

/** Variáveis do módulo + variáveis gerais (entidade, local). */
export function variablesForModulo(modulo: TemplateModulo): TemplateVariableDef[] {
  const geral = TEMPLATE_VARIABLES.geral.filter(
    (v) => !TEMPLATE_VARIABLES[modulo].some((m) => m.key === v.key),
  );
  return [...TEMPLATE_VARIABLES[modulo], ...geral];
}

export function groupVariables(vars: TemplateVariableDef[]): Map<string, TemplateVariableDef[]> {
  const map = new Map<string, TemplateVariableDef[]>();
  for (const v of vars) {
    const list = map.get(v.grupo) ?? [];
    list.push(v);
    map.set(v.grupo, list);
  }
  return map;
}

export function variableToken(key: string): string {
  return `{{${key}}}`;
}
