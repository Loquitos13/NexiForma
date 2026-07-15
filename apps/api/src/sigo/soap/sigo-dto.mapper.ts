import {
  mapAcaoEstadoToSigo,
  normalizarTipoDocumentoSigo,
  type NexiformaSigoExportBody,
  type SubmeterAcaoSigoDTO,
  type FormandoSigoDTO,
  type ConsultarEstadoSigoDTO,
} from "@nexiforma/shared";
import { formatSigoDateOnly } from "./sigo-date.util";

export function mapExportToSubmeterAcaoDto(
  pkg: NexiformaSigoExportBody,
  referenceId: string,
  codigoEntidade?: string | null,
): SubmeterAcaoSigoDTO {
  const estadoInterno = (pkg.acaoFormacao.estado ?? "CONCLUIDA") as
    | "PLANEADA"
    | "EM_CURSO"
    | "CONCLUIDA"
    | "CANCELADA";
  const estadoSigo = mapAcaoEstadoToSigo(estadoInterno) ?? "CONCLUIDA";

  const formandos: FormandoSigoDTO[] = pkg.formandos.map((f) => {
    const tipo = normalizarTipoDocumentoSigo(f.tipoDocIdentificacao);
    if (!tipo) {
      throw new Error(`Tipo documento inválido para formando ${f.nome}.`);
    }
    const dataNasc = formatSigoDateOnly(f.dataNascimento);
    if (!dataNasc) {
      throw new Error(`Data nascimento inválida para formando ${f.nome}.`);
    }
    const hab = Number.parseInt(String(f.habilitacaoLiteraria ?? ""), 10);
    if (!Number.isFinite(hab)) {
      throw new Error(`Habilitações literárias inválidas para formando ${f.nome}.`);
    }

    return {
      TipoDocumento: tipo,
      NumeroDocumento: f.numDocIdentificacao!.trim(),
      NIF: f.nif.replace(/\s/g, ""),
      DataNascimento: dataNasc,
      Nome: f.nome.trim(),
      Nacionalidade: (f.nacionalidade ?? "PT").trim().toUpperCase(),
      HabilitacoesLiterarias: hab,
      ...(f.matriculaId ? { MatriculaExterna: f.matriculaId } : {}),
    };
  });

  const dataInicio = formatSigoDateOnly(pkg.acaoFormacao.dataInicio);
  const dataFim = formatSigoDateOnly(pkg.acaoFormacao.dataFim);
  if (!dataInicio || !dataFim) {
    throw new Error("Datas da acção inválidas para SIGO.");
  }

  return {
    ReferenciaExterna: referenceId,
    Entidade: {
      NIF: (pkg.entidadeFormadora.nif ?? "").replace(/\s/g, ""),
      Denominacao: pkg.entidadeFormadora.denominacao ?? "",
      ...(codigoEntidade?.trim() ? { CodigoEntidade: codigoEntidade.trim() } : {}),
    },
    Acao: {
      CodigoInterno: pkg.acaoFormacao.codigoInterno,
      Titulo: pkg.acaoFormacao.titulo,
      Estado: estadoSigo,
      DataInicio: dataInicio,
      DataFim: dataFim,
    },
    Curso: {
      CodigoUFCD: pkg.cursoModulo.codigoUfcd!.trim(),
      Designacao: pkg.cursoModulo.designacao,
      CargaHoras: pkg.cursoModulo.cargaHoras,
      Modalidade: pkg.cursoModulo.modalidade,
    },
    Formandos: formandos,
  };
}

export function mapConsultarEstadoDto(referenceId: string): ConsultarEstadoSigoDTO {
  return { ReferenciaExterna: referenceId };
}
