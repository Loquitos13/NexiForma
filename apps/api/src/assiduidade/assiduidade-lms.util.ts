/** Cálculos de assiduidade a partir de eventos LMS (join/leave). */



import {

  calcularSegundosPresencaJoinLeave,

  type LmsEventoPresenca,

} from "@nexiforma/shared";



export function hhMmToMinutes(hhmm: string): number {

  const [h, m] = hhmm.split(":").map(Number);

  return h * 60 + m;

}



export function sessaoDuracaoMinutos(horaInicio: string, horaFim: string): number {

  return Math.max(0, hhMmToMinutes(horaFim) - hhMmToMinutes(horaInicio));

}



export type AcessoLike = LmsEventoPresenca;



/** Soma segundos efectivos com base em pares join → leave. */

export function totalSegundosLms(

  acessos: AcessoLike[],

  opts?: { ate?: Date; sessaoFim?: Date },

): number {

  return calcularSegundosPresencaJoinLeave(acessos, opts);

}



export function presentePorMinutos(

  minutosEfetivos: number,

  minutosPresencaMin: number,

): boolean {

  return minutosEfetivos >= minutosPresencaMin;

}



export function sessaoFimDate(data: Date, horaFim: string): Date {

  const [h, m] = horaFim.split(":").map(Number);

  const d = new Date(data);

  d.setHours(h, m, 0, 0);

  return d;

}


