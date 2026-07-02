import {
  AT_SERIES_CLASSE_SI,
  AT_SERIES_MEIO_PI,
  AT_SERIES_NS,
  AT_SERIES_TIPO_NORMAL,
} from "./at-series-constants";
import { buildAtSoapEnvelope } from "./at-soap-envelope.util";
import type { AtSecurityHeaderFields } from "./at-faturas-security.util";

export type AtSerieDocumentoInput = {
  serie: string;
  tipoDocumento: string;
  numInicialSeq: number;
  dataInicioPrevUtiliz: Date;
  numCertSWFatur: string;
  tipoSerie?: string;
  classeDoc?: string;
  meioProcessamento?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeCertNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.padStart(4, "0").slice(0, 4);
}

export function buildRegistarSerieBody(input: AtSerieDocumentoInput): string {
  const tipoDoc = input.tipoDocumento.toUpperCase();
  return `<ns2:registarSerie xmlns:ns2="${AT_SERIES_NS}">
      <serie>${escapeXml(input.serie)}</serie>
      <tipoSerie>${escapeXml(input.tipoSerie ?? AT_SERIES_TIPO_NORMAL)}</tipoSerie>
      <classeDoc>${escapeXml(input.classeDoc ?? AT_SERIES_CLASSE_SI)}</classeDoc>
      <tipoDoc>${escapeXml(tipoDoc)}</tipoDoc>
      <numInicialSeq>${input.numInicialSeq}</numInicialSeq>
      <dataInicioPrevUtiliz>${formatDate(input.dataInicioPrevUtiliz)}</dataInicioPrevUtiliz>
      <numCertSWFatur>${escapeXml(normalizeCertNumber(input.numCertSWFatur))}</numCertSWFatur>
      <meioProcessamento>${escapeXml(input.meioProcessamento ?? AT_SERIES_MEIO_PI)}</meioProcessamento>
    </ns2:registarSerie>`;
}

export function buildFinalizarSerieBody(input: {
  serie: string;
  tipoDocumento: string;
  numCertSWFatur: string;
  dataFimUtiliz: Date;
}): string {
  return `<ns2:finalizarSerie xmlns:ns2="${AT_SERIES_NS}">
      <serie>${escapeXml(input.serie)}</serie>
      <tipoDoc>${escapeXml(input.tipoDocumento.toUpperCase())}</tipoDoc>
      <numCertSWFatur>${escapeXml(normalizeCertNumber(input.numCertSWFatur))}</numCertSWFatur>
      <dataFimUtiliz>${formatDate(input.dataFimUtiliz)}</dataFimUtiliz>
    </ns2:finalizarSerie>`;
}

export function buildAnularSerieBody(input: {
  serie: string;
  tipoDocumento: string;
  numCertSWFatur: string;
  motivo?: string;
}): string {
  const motivo = input.motivo?.trim() || "Anulação comunicação série";
  return `<ns2:anularSerie xmlns:ns2="${AT_SERIES_NS}">
      <serie>${escapeXml(input.serie)}</serie>
      <tipoDoc>${escapeXml(input.tipoDocumento.toUpperCase())}</tipoDoc>
      <numCertSWFatur>${escapeXml(normalizeCertNumber(input.numCertSWFatur))}</numCertSWFatur>
      <motivo>${escapeXml(motivo.slice(0, 200))}</motivo>
    </ns2:anularSerie>`;
}

export function buildRegistarSerieSoapEnvelope(
  security: AtSecurityHeaderFields,
  input: AtSerieDocumentoInput,
): string {
  return buildAtSoapEnvelope(security, buildRegistarSerieBody(input));
}

export function buildFinalizarSerieSoapEnvelope(
  security: AtSecurityHeaderFields,
  input: Parameters<typeof buildFinalizarSerieBody>[0],
): string {
  return buildAtSoapEnvelope(security, buildFinalizarSerieBody(input));
}

export function buildAnularSerieSoapEnvelope(
  security: AtSecurityHeaderFields,
  input: Parameters<typeof buildAnularSerieBody>[0],
): string {
  return buildAtSoapEnvelope(security, buildAnularSerieBody(input));
}

export function hashAtSeriePayload(input: AtSerieDocumentoInput): string {
  return `${input.serie}|${input.tipoDocumento}|${input.numInicialSeq}|${formatDate(input.dataInicioPrevUtiliz)}`;
}
