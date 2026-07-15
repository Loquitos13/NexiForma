"use client";

import { Textarea } from "@/components/ui";

export type PropostaConteudoForm = {
  subtitulo: string;
  apresentacaoEmpresa: string;
  enquadramento: string;
  objetivos: string;
  conteudosProgramaticos: string;
  metodologia: string;
  destinatarios: string;
  duracaoTexto: string;
  localTexto: string;
  beneficios: string;
  condicoesComerciais: string;
  porqueEscolher: string;
  proximosPassos: string;
};

export const EMPTY_CONTEUDO: PropostaConteudoForm = {
  subtitulo: "",
  apresentacaoEmpresa: "",
  enquadramento: "",
  objetivos: "",
  conteudosProgramaticos: "",
  metodologia: "",
  destinatarios: "",
  duracaoTexto: "",
  localTexto: "",
  beneficios: "",
  condicoesComerciais: "",
  porqueEscolher: "",
  proximosPassos: "",
};

type FieldDef = {
  key: keyof PropostaConteudoForm;
  label: string;
  rows: number;
  hint?: string;
  padraoKey?: keyof PropostaConteudoForm | string;
};

const SECOES: FieldDef[] = [
  { key: "subtitulo", label: "Subtítulo da proposta", rows: 2, hint: "Ex.: Serviço de Formação Comercial para Equipas de Farmácia" },
  { key: "apresentacaoEmpresa", label: "Apresentação da empresa", rows: 4, hint: "Deixe vazio para usar o texto padrão do gestor." },
  { key: "enquadramento", label: "1. Enquadramento", rows: 5 },
  { key: "objetivos", label: "2. Objectivos da formação", rows: 5, hint: "Uma linha por objectivo, prefixo - opcional." },
  { key: "conteudosProgramaticos", label: "3. Conteúdos programáticos", rows: 8 },
  { key: "metodologia", label: "4. Metodologia", rows: 4 },
  { key: "destinatarios", label: "5. Destinatários", rows: 3 },
  { key: "duracaoTexto", label: "6. Duração", rows: 2 },
  { key: "localTexto", label: "7. Local", rows: 2 },
  { key: "beneficios", label: "8. Benefícios", rows: 5 },
  { key: "condicoesComerciais", label: "10. Condições comerciais", rows: 4 },
  { key: "porqueEscolher", label: "11. Porque escolher a nossa formação", rows: 4 },
  { key: "proximosPassos", label: "12. Próximos passos", rows: 4 },
];

type Props = {
  value: PropostaConteudoForm;
  onChange: (next: PropostaConteudoForm) => void;
  padroes?: Partial<PropostaConteudoForm> & Record<string, string | undefined>;
  readOnly?: boolean;
};

export function conteudoTemCamposPreenchidos(c: PropostaConteudoForm): boolean {
  return Object.values(c).some((v) => v.trim().length > 0);
}

export function PropostaConteudoFields({ value, onChange, padroes, readOnly }: Props) {
  function setField(key: keyof PropostaConteudoForm, v: string) {
    onChange({ ...value, [key]: v });
  }

  function restaurarPadrao(key: keyof PropostaConteudoForm) {
    const padraoMap: Partial<Record<keyof PropostaConteudoForm, string>> = {
      apresentacaoEmpresa: padroes?.apresentacaoEmpresa,
      enquadramento: padroes?.enquadramento,
      objetivos: padroes?.objetivos,
      conteudosProgramaticos: padroes?.conteudosProgramaticos,
      metodologia: padroes?.metodologia,
      destinatarios: padroes?.destinatarios,
      duracaoTexto: padroes?.duracaoTexto,
      localTexto: padroes?.localTexto,
      beneficios: padroes?.beneficios,
      condicoesComerciais: padroes?.condicoesComerciais,
      porqueEscolher: padroes?.porqueEscolher,
      proximosPassos: padroes?.proximosPassos,
    };
    setField(key, padraoMap[key] ?? "");
  }

  const secoesVisiveis = readOnly
    ? SECOES.filter((sec) => value[sec.key].trim().length > 0)
    : SECOES;

  if (readOnly && secoesVisiveis.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {secoesVisiveis.map((sec) => (
        <div key={sec.key} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-slate-200">{sec.label}</label>
            {!readOnly && padroes && sec.key !== "subtitulo" ? (
              <button
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300"
                onClick={() => restaurarPadrao(sec.key)}
              >
                Usar padrão
              </button>
            ) : null}
          </div>
          {!readOnly && sec.hint ? <p className="text-xs text-slate-500">{sec.hint}</p> : null}
          {readOnly ? (
            <p className="whitespace-pre-wrap rounded-lg border border-slate-700/40 bg-slate-950/40 px-3 py-2.5 text-sm leading-relaxed text-slate-300">
              {value[sec.key]}
            </p>
          ) : (
            <Textarea
              value={value[sec.key]}
              onChange={(e) => setField(sec.key, e.target.value)}
              rows={sec.rows}
              className="font-mono text-sm"
              placeholder={
                padroes && sec.key !== "subtitulo" && !value[sec.key]
                  ? "(vazio = texto padrão da empresa)"
                  : undefined
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function configToPadroesForm(config: Record<string, unknown>): PropostaConteudoForm {
  return {
    subtitulo: "",
    apresentacaoEmpresa: String(config.apresentacaoEmpresa ?? ""),
    enquadramento: String(config.enquadramentoPadrao ?? ""),
    objetivos: String(config.objetivosPadrao ?? ""),
    conteudosProgramaticos: String(config.conteudosProgramaticosPadrao ?? ""),
    metodologia: String(config.metodologiaPadrao ?? ""),
    destinatarios: String(config.destinatariosPadrao ?? ""),
    duracaoTexto: String(config.duracaoTextoPadrao ?? ""),
    localTexto: String(config.localTextoPadrao ?? ""),
    beneficios: String(config.beneficiosPadrao ?? ""),
    condicoesComerciais: String(config.condicoesComerciaisPadrao ?? ""),
    porqueEscolher: String(config.porqueEscolherPadrao ?? ""),
    proximosPassos: String(config.proximosPassosPadrao ?? ""),
  };
}

export function propostaToConteudoForm(p: Record<string, unknown>): PropostaConteudoForm {
  return {
    subtitulo: String(p.subtitulo ?? ""),
    apresentacaoEmpresa: String(p.apresentacaoEmpresa ?? ""),
    enquadramento: String(p.enquadramento ?? ""),
    objetivos: String(p.objetivos ?? ""),
    conteudosProgramaticos: String(p.conteudosProgramaticos ?? ""),
    metodologia: String(p.metodologia ?? ""),
    destinatarios: String(p.destinatarios ?? ""),
    duracaoTexto: String(p.duracaoTexto ?? ""),
    localTexto: String(p.localTexto ?? ""),
    beneficios: String(p.beneficios ?? ""),
    condicoesComerciais: String(p.condicoesComerciais ?? ""),
    porqueEscolher: String(p.porqueEscolher ?? ""),
    proximosPassos: String(p.proximosPassos ?? ""),
  };
}

export function conteudoToApiPayload(c: PropostaConteudoForm): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(c)) {
    out[k] = v.trim() || null;
  }
  return out;
}
