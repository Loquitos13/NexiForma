import { AT_SOAP_ENVELOPE_NS, AT_WSSE_NS } from "./at-faturas-constants";
import type { AtSecurityHeaderFields } from "./at-faturas-security.util";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildAtSoapSecurityHeader(security: AtSecurityHeaderFields): string {
  return `<S:Header>
    <wss:Security xmlns:wss="${AT_WSSE_NS}">
      <wss:UsernameToken>
        <wss:Username>${escapeXml(security.username)}</wss:Username>
        <wss:Password>${escapeXml(security.passwordEnc)}</wss:Password>
        <wss:Nonce>${escapeXml(security.nonceEnc)}</wss:Nonce>
        <wss:Created>${escapeXml(security.createdEnc)}</wss:Created>
      </wss:UsernameToken>
    </wss:Security>
  </S:Header>`;
}

export function buildAtSoapEnvelope(security: AtSecurityHeaderFields, bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="${AT_SOAP_ENVELOPE_NS}">
  ${buildAtSoapSecurityHeader(security)}
  <S:Body>
    ${bodyXml}
  </S:Body>
</S:Envelope>`;
}
