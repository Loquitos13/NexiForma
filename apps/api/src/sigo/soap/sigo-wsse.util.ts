import { SIGO_WSSE_NS } from "./sigo-soap-constants";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type SigoWsseCredentials = {
  username: string;
  password: string;
};

export function buildSigoWsseSecurityHeader(creds: SigoWsseCredentials): string {
  return `<wsse:Security xmlns:wsse="${SIGO_WSSE_NS}" soap:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(creds.username)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(creds.password)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>`;
}
