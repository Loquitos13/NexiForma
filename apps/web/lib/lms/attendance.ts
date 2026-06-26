import {
  formatarDuracaoHhMmSs,
  resolverEstadoPresenca,
} from "@nexiforma/shared";

export type LmsAcessoRow = {
  id: string;
  evento: string;
  duracaoSegundos: number | null;
  ocorridoEm: string;
  sessaoFormacaoId?: string | null;
  sessao?: {
    id: string;
    numeroSessao: number;
    data: string;
    horaInicio: string;
  } | null;
  matricula?: {
    id: string;
    formando: { nome: string; nif: string };
  };
};

export function formatarLabelSessaoLms(
  sessao?: LmsAcessoRow["sessao"],
  sessaoFormacaoId?: string | null,
): string {
  if (sessao) {
    const data = String(sessao.data).slice(0, 10);
    return `S${sessao.numeroSessao} · ${data}`;
  }
  return sessaoFormacaoId ? `Sessão ${sessaoFormacaoId.slice(0, 8)}…` : "–";
}

/** Apenas join/leave - ignora heartbeats legados. */
export function filtrarEventosJoinLeave(acessos: LmsAcessoRow[]): LmsAcessoRow[] {
  return acessos.filter((a) => {
    const ev = a.evento.toLowerCase();
    return ev === "join" || ev === "leave";
  });
}

export type FormandoAssiduidade = {
  matriculaId: string;
  nome: string;
  nif: string;
  segundosTotal: number;
  segundosFechados: number;
  minutosEfetivos: number;
  tempoFormatado: string;
  emSessao: boolean;
  joinDesde: string | null;
  joins: number;
  leaves: number;
  presentePrevisto: boolean;
};

export function aggregateLmsAcessos(
  acessos: LmsAcessoRow[],
  limiarMinutos: number,
  opts?: { ate?: Date },
): FormandoAssiduidade[] {
  const ate = opts?.ate ?? new Date();
  const byMatricula = new Map<string, FormandoAssiduidade & { eventos: LmsAcessoRow[] }>();

  for (const a of acessos) {
    const matriculaId = a.matricula?.id;
    if (!matriculaId) continue;

    let row = byMatricula.get(matriculaId);
    if (!row) {
      row = {
        matriculaId,
        nome: a.matricula!.formando.nome,
        nif: a.matricula!.formando.nif,
        segundosTotal: 0,
        segundosFechados: 0,
        minutosEfetivos: 0,
        tempoFormatado: "00:00:00",
        emSessao: false,
        joinDesde: null,
        joins: 0,
        leaves: 0,
        presentePrevisto: false,
        eventos: [],
      };
      byMatricula.set(matriculaId, row);
    }

    const ev = a.evento.toLowerCase();
    if (ev === "join") row.joins += 1;
    if (ev === "leave") row.leaves += 1;
    row.eventos.push(a);
  }

  return [...byMatricula.values()]
    .map(({ eventos, ...r }) => {
      const presenca = resolverEstadoPresenca(
        eventos.map((e) => ({
          evento: e.evento,
          ocorridoEm: e.ocorridoEm,
          duracaoSegundos: e.duracaoSegundos,
        })),
        ate,
      );
      const segundosTotal = presenca.segundosTotais;
      const minutos = Math.round(segundosTotal / 60);
      return {
        ...r,
        segundosTotal,
        segundosFechados: presenca.segundosFechados,
        minutosEfetivos: minutos,
        tempoFormatado: formatarDuracaoHhMmSs(segundosTotal),
        emSessao: presenca.emSessao,
        joinDesde: presenca.joinDesde,
        presentePrevisto: minutos >= limiarMinutos,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
}

export { formatarDuracaoHhMmSs, resolverEstadoPresenca };
