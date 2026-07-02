import { createSign, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";

/** Campos para assinatura RSA-SHA1 encadeada (Portaria 363/2010 / Despacho 8632/2014). */
export type AtAssinaturaDocumentoInput = {
  invoiceDate: Date;
  systemEntryDate: Date;
  invoiceNo: string;
  grossTotalCentavos: number;
  hashDocumentoAnterior?: string | null;
};

export function formatarAtInvoiceDate(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function formatarAtSystemEntryDate(data: Date): string {
  return data.toISOString().slice(0, 19);
}

export function formatarAtGrossTotal(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

export function formatarAtInvoiceNo(tipoDocumento: string, serie: string, numero: number): string {
  const tipo = tipoDocumento.toUpperCase();
  return `${tipo} ${serie}/${numero}`;
}

/** Texto canónico a assinar: campos separados por «;», hash anterior vazio no 1.º documento da série. */
export function montarPayloadAssinaturaAt(input: AtAssinaturaDocumentoInput): string {
  const gross = formatarAtGrossTotal(input.grossTotalCentavos);
  const prev = input.hashDocumentoAnterior?.trim() ?? "";
  return [
    formatarAtInvoiceDate(input.invoiceDate),
    formatarAtSystemEntryDate(input.systemEntryDate),
    input.invoiceNo,
    gross,
    prev,
  ].join(";");
}

export function assinarDocumentoFaturaAt(
  privateKeyPem: string,
  input: AtAssinaturaDocumentoInput,
): string {
  const payload = montarPayloadAssinaturaAt(input);
  const sign = createSign("RSA-SHA1");
  sign.update(payload);
  sign.end();
  return sign.sign(privateKeyPem, "base64");
}

export function verificarAssinaturaDocumentoFaturaAt(
  publicKeyPem: string,
  input: AtAssinaturaDocumentoInput,
  assinaturaBase64: string,
): boolean {
  const payload = montarPayloadAssinaturaAt(input);
  const verify = createVerify("RSA-SHA1");
  verify.update(payload);
  verify.end();
  return verify.verify(publicKeyPem, assinaturaBase64, "base64");
}

/** Assinatura RSA AT em Base64 (~172 caracteres). */
export function isAssinaturaAtRsa(hash: string | null | undefined): boolean {
  const h = hash?.trim() ?? "";
  return h.length >= 100 && /^[A-Za-z0-9+/]+=*$/.test(h);
}

export function carregarChaveAtDeFicheiro(path: string): string {
  return readFileSync(path, "utf8");
}
