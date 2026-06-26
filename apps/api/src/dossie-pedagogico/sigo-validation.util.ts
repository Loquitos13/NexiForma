export type SigoValidationMessage = {
  codigo: string;
  mensagem: string;
  campo?: string;
};

/** Regras mínimas por UFCD conhecido (expandir com catálogo CNQ). */
const UFCD_REGRAS: Record<
  string,
  { designacao?: string; cargaHorasMinima?: number; notas?: string }
> = {
  "7834": {
    designacao: "Sensibilização à qualidade na restauração",
    cargaHorasMinima: 50,
    notas: "Exemplo seed NexiForma – validar carga face ao programa certificado.",
  },
};

export function normalizarNif(nif: string): string {
  return nif.replace(/\s/g, "").trim();
}

/** Validação sintática NIF português (9 dígitos + dígito de controlo). */
export function isValidNifPt(nif: string): boolean {
  const d = normalizarNif(nif);
  if (!/^\d{9}$/.test(d)) return false;
  const checkDigit = Number(d[8]);
  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    sum += Number(d[i]) * (9 - i);
  }
  const rest = sum % 11;
  const expected = rest < 2 ? 0 : 11 - rest;
  return checkDigit === expected;
}

export function isValidUfcdCode(codigo: string | null | undefined): boolean {
  if (!codigo?.trim()) return false;
  return /^\d{3,5}$/.test(codigo.trim());
}

export type SigoPayloadForValidation = {
  entidadeFormadora: { nif: string; denominacao: string };
  acaoFormacao: { codigoInterno: string; dataInicio: string; dataFim: string; titulo: string };
  cursoModulo: {
    codigoUfcd: string | null;
    designacao: string;
    cargaHoras: number;
    modalidade: string;
    objetivos: string | null;
  };
  formandos: Array<{ nif: string; nome: string }>;
  formadores: Array<{ nif: string; nome: string }>;
  planoFormativo: Array<{
    numeroSessao: number;
    estado: string;
    sumarioAssinado: boolean;
    folhaPresencaFechada: boolean;
    formador: { nif: string } | null;
  }>;
  checklistSigo: { items: Array<{ id: string; ok: boolean }> };
};

export function validateSigoPayload(payload: SigoPayloadForValidation) {
  const erros: SigoValidationMessage[] = [];
  const avisos: SigoValidationMessage[] = [];

  const { entidadeFormadora: ent, acaoFormacao: acao, cursoModulo: curso } = payload;

  if (!ent.nif?.trim()) {
    erros.push({
      codigo: "ENTIDADE_NIF_AUSENTE",
      mensagem: "NIF da entidade formadora em falta.",
      campo: "entidadeFormadora.nif",
    });
  } else if (!isValidNifPt(ent.nif)) {
    erros.push({
      codigo: "ENTIDADE_NIF_INVALIDO",
      mensagem: `NIF da entidade inválido: ${ent.nif}`,
      campo: "entidadeFormadora.nif",
    });
  }

  if (!curso.codigoUfcd?.trim()) {
    erros.push({
      codigo: "UFCD_AUSENTE",
      mensagem: "Código UFCD/módulo CNQ em falta (obrigatório para registo SIGO).",
      campo: "cursoModulo.codigoUfcd",
    });
  } else if (!isValidUfcdCode(curso.codigoUfcd)) {
    avisos.push({
      codigo: "UFCD_FORMATO",
      mensagem: `Código UFCD «${curso.codigoUfcd}» – formato esperado: 3–5 dígitos.`,
      campo: "cursoModulo.codigoUfcd",
    });
  }

  if (curso.cargaHoras <= 0) {
    erros.push({
      codigo: "CARGA_HORAS",
      mensagem: "Carga horária do curso deve ser superior a zero.",
      campo: "cursoModulo.cargaHoras",
    });
  }

  if (!curso.objetivos?.trim()) {
    avisos.push({
      codigo: "OBJETIVOS_AUSENTES",
      mensagem: "Objectivos de aprendizagem não descritos no dossiê.",
      campo: "cursoModulo.objetivos",
    });
  }

  if (acao.dataFim < acao.dataInicio) {
    erros.push({
      codigo: "ACAO_DATAS",
      mensagem: "Data fim anterior à data início da acção.",
      campo: "acaoFormacao",
    });
  }

  if (!acao.codigoInterno?.trim()) {
    erros.push({
      codigo: "ACAO_CODIGO",
      mensagem: "Código interno da acção em falta.",
      campo: "acaoFormacao.codigoInterno",
    });
  }

  if (payload.formandos.length === 0) {
    erros.push({
      codigo: "SEM_FORMANDOS",
      mensagem: "Nenhum formando matriculado – necessário para SIGO.",
    });
  }

  for (const f of payload.formandos) {
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
  }

  if (payload.formadores.length === 0) {
    avisos.push({
      codigo: "SEM_FORMADORES",
      mensagem: "Nenhum formador associado a sessões.",
    });
  }

  for (const f of payload.formadores) {
    if (!isValidNifPt(f.nif)) {
      avisos.push({
        codigo: "FORMADOR_NIF",
        mensagem: `NIF do formador «${f.nome}» inválido ou em falta.`,
      });
    }
  }

  if (payload.planoFormativo.length === 0) {
    erros.push({
      codigo: "SEM_SESSOES",
      mensagem: "Cronograma sem sessões planeadas.",
    });
  }

  const realizadas = payload.planoFormativo.filter((s) => s.estado === "REALIZADA");
  for (const s of realizadas) {
    if (!s.sumarioAssinado) {
      avisos.push({
        codigo: "SUMARIO_PENDENTE",
        mensagem: `Sessão ${s.numeroSessao} realizada sem sumário assinado.`,
      });
    }
    if (!s.folhaPresencaFechada) {
      avisos.push({
        codigo: "FOLHA_ABERTA",
        mensagem: `Sessão ${s.numeroSessao}: folha de presença não fechada.`,
      });
    }
    if (s.formador && !isValidNifPt(s.formador.nif)) {
      avisos.push({
        codigo: "SESSAO_FORMADOR_NIF",
        mensagem: `Sessão ${s.numeroSessao}: formador sem NIF válido.`,
      });
    }
  }

  const ufcdNorm = curso.codigoUfcd?.trim() ?? "";
  const regrasUfcd = ufcdNorm ? UFCD_REGRAS[ufcdNorm] : undefined;
  const ufcdRegrasAplicadas: string[] = [];

  if (regrasUfcd?.cargaHorasMinima != null) {
    ufcdRegrasAplicadas.push(
      `UFCD ${ufcdNorm}: carga horária mínima de referência ${regrasUfcd.cargaHorasMinima}h.`,
    );
    if (curso.cargaHoras < regrasUfcd.cargaHorasMinima) {
      avisos.push({
        codigo: "UFCD_CARGA_MINIMA",
        mensagem: `UFCD ${ufcdNorm}: carga registada ${curso.cargaHoras}h < mínimo de referência ${regrasUfcd.cargaHorasMinima}h.`,
        campo: "cursoModulo.cargaHoras",
      });
    }
  } else if (ufcdNorm) {
    ufcdRegrasAplicadas.push(
      `UFCD ${ufcdNorm}: sem regras específicas no catálogo NexiForma (validação genérica).`,
    );
  }

  const checklistOk = payload.checklistSigo.items.every((i) => i.ok);

  return {
    valido: erros.length === 0,
    prontoParaImportacaoSigo: erros.length === 0 && checklistOk,
    erros,
    avisos,
    ufcd: {
      codigo: ufcdNorm || null,
      regrasCatalogo: regrasUfcd ?? null,
      regrasAplicadas: ufcdRegrasAplicadas,
    },
    resumo: {
      totalErros: erros.length,
      totalAvisos: avisos.length,
      checklistSigoCompleto: checklistOk,
    },
  };
}
