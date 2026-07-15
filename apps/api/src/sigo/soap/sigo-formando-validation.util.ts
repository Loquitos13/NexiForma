import {
  SIGO_HABILITACOES_CNQ,
  normalizarTipoDocumentoSigo,
  type SigoFormandoMetadata,
} from "@nexiforma/shared";
import type { SigoValidationMessage } from "../../dossie-pedagogico/sigo-validation.util";
import { isValidNifPt } from "../../dossie-pedagogico/sigo-validation.util";

const ISO_COUNTRY = /^[A-Z]{2}$/;

export type SigoFormandoParaValidacao = {
  nif: string;
  nome: string;
  matriculaId?: string;
  sigo?: SigoFormandoMetadata;
};

function isValidDateIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function validarFormandoSigo(f: SigoFormandoParaValidacao): SigoValidationMessage[] {
  const erros: SigoValidationMessage[] = [];
  const sigo = f.sigo ?? {};

  if (!f.nif?.trim()) {
    erros.push({
      codigo: "FORMANDO_NIF_AUSENTE",
      mensagem: `Formando «${f.nome}» sem NIF.`,
      campo: "formandos",
    });
  } else if (!isValidNifPt(f.nif)) {
    erros.push({
      codigo: "FORMANDO_NIF_INVALIDO",
      mensagem: `NIF inválido para «${f.nome}»: ${f.nif}`,
      campo: "formandos",
    });
  }

  if (!sigo.tipoDocIdentificacao?.trim()) {
    erros.push({
      codigo: "FORMANDO_TIPO_DOC_AUSENTE",
      mensagem: `«${f.nome}»: tipo de documento (CC/PAS/BI) em falta em metadata.sigo.`,
      campo: "formandos.metadata.sigo.tipoDocIdentificacao",
    });
  } else if (!normalizarTipoDocumentoSigo(sigo.tipoDocIdentificacao)) {
    erros.push({
      codigo: "FORMANDO_TIPO_DOC_INVALIDO",
      mensagem: `«${f.nome}»: tipo documento «${sigo.tipoDocIdentificacao}» inválido (CC, PAS, BI).`,
      campo: "formandos.metadata.sigo.tipoDocIdentificacao",
    });
  }

  if (!sigo.numDocIdentificacao?.trim()) {
    erros.push({
      codigo: "FORMANDO_NUM_DOC_AUSENTE",
      mensagem: `«${f.nome}»: número CC/passaporte em falta em metadata.sigo.`,
      campo: "formandos.metadata.sigo.numDocIdentificacao",
    });
  }

  if (!sigo.dataNascimento?.trim()) {
    erros.push({
      codigo: "FORMANDO_DATA_NASC_AUSENTE",
      mensagem: `«${f.nome}»: data de nascimento em falta (AAAA-MM-DD).`,
      campo: "formandos.metadata.sigo.dataNascimento",
    });
  } else if (!isValidDateIso(sigo.dataNascimento)) {
    erros.push({
      codigo: "FORMANDO_DATA_NASC_INVALIDA",
      mensagem: `«${f.nome}»: data nascimento inválida «${sigo.dataNascimento}».`,
      campo: "formandos.metadata.sigo.dataNascimento",
    });
  }

  if (!sigo.nacionalidade?.trim()) {
    erros.push({
      codigo: "FORMANDO_NACIONALIDADE_AUSENTE",
      mensagem: `«${f.nome}»: nacionalidade em falta (código ISO, ex: PT).`,
      campo: "formandos.metadata.sigo.nacionalidade",
    });
  } else if (!ISO_COUNTRY.test(sigo.nacionalidade.trim().toUpperCase())) {
    erros.push({
      codigo: "FORMANDO_NACIONALIDADE_INVALIDA",
      mensagem: `«${f.nome}»: nacionalidade «${sigo.nacionalidade}» – use código ISO-2 (PT, BR, …).`,
      campo: "formandos.metadata.sigo.nacionalidade",
    });
  }

  if (!sigo.habilitacaoLiteraria?.trim()) {
    erros.push({
      codigo: "FORMANDO_HABILITACAO_AUSENTE",
      mensagem: `«${f.nome}»: habilitações literárias em falta (código CNQ/SIGO).`,
      campo: "formandos.metadata.sigo.habilitacaoLiteraria",
    });
  } else if (
    !SIGO_HABILITACOES_CNQ.includes(
      sigo.habilitacaoLiteraria as (typeof SIGO_HABILITACOES_CNQ)[number],
    )
  ) {
    erros.push({
      codigo: "FORMANDO_HABILITACAO_INVALIDA",
      mensagem: `«${f.nome}»: código habilitação «${sigo.habilitacaoLiteraria}» não está na tabela CNQ.`,
      campo: "formandos.metadata.sigo.habilitacaoLiteraria",
    });
  }

  return erros;
}
