import forge from "node-forge";
import { readFileSync } from "node:fs";
import type https from "node:https";

/** Carrega PFX com algoritmos legados (3DES) não suportados nativamente em Node 17+. */
export function loadPfxAsTlsOptions(pfxPath: string, passphrase: string): https.AgentOptions {
  const pfxDer = readFileSync(pfxPath);
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxDer));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ??
    [];

  const keyBag = keyBags[0];
  if (!keyBag?.key) {
    throw new Error(`PFX sem chave privada: ${pfxPath}`);
  }

  const certs = certBags
    .map((b) => b.cert)
    .filter(Boolean)
    .map((c) => forge.pki.certificateToPem(c!));

  return {
    cert: certs.join("\n"),
    key: forge.pki.privateKeyToPem(keyBag.key),
    rejectUnauthorized: true,
  };
}

export type AtPfxClientCertInfo = {
  subject: string;
  notAfter: Date;
  expired: boolean;
};

/** Certificado de cliente dentro do PFX (ex. TesteWebservices). */
export function inspectAtPfxClientCert(
  pfxPath: string,
  passphrase: string,
): AtPfxClientCertInfo | null {
  try {
    const pfxDer = readFileSync(pfxPath);
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxDer));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);
    const certBags =
      p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
    const clientCert = certBags.find((b) => {
      const cn = b.cert?.subject.getField("CN")?.value ?? "";
      return !/CA$/i.test(String(cn)) && !String(cn).includes("Root") && !String(cn).includes("Issuing");
    })?.cert ?? certBags[0]?.cert;
    if (!clientCert) return null;
    const notAfter = clientCert.validity.notAfter;
    return {
      subject: String(clientCert.subject.getField("CN")?.value ?? "client"),
      notAfter,
      expired: notAfter.getTime() < Date.now(),
    };
  } catch {
    return null;
  }
}
