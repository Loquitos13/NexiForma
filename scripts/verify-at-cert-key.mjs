#!/usr/bin/env node
/**
 * Verifica se um certificado AT (.cer/.crt/.pem) corresponde à chave privada (.key).
 *
 * Uso:
 *   npm run verify:at-cert-key -- --cert ./certs/adesao/515834963.crt --key ./certs/adesao/515834963.key
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicKey, X509Certificate } from "node:crypto";
import { loadNodeForge, root } from "./at-forge.mjs";

const forge = loadNodeForge();

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function loadCertPem(certPath) {
  const raw = readFileSync(certPath, "utf8");
  if (raw.includes("BEGIN CERTIFICATE")) return raw;
  const der = Buffer.from(raw.replace(/\s/g, ""), "base64");
  const cert = new X509Certificate(der);
  return cert.toString();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.cert || !args.key) {
    console.error("Uso: npm run verify:at-cert-key -- --cert <.cer> --key <.key>");
    process.exit(1);
  }

  const certPath = resolve(root, args.cert);
  const keyPath = resolve(root, args.key);
  if (!existsSync(certPath) || !existsSync(keyPath)) {
    console.error("Erro: certificado ou chave em falta.");
    process.exit(1);
  }

  const certPem = loadCertPem(certPath);
  const cert = new X509Certificate(certPem);
  const certPub = cert.publicKey.export({ type: "spki", format: "der" });
  const keyPub = createPublicKey(readFileSync(keyPath, "utf8")).export({ type: "spki", format: "der" });
  const match = certPub.equals(keyPub);

  console.log("Certificado:");
  console.log("  Subject:", cert.subject.replace(/\n/g, ", "));
  console.log("  Validade:", cert.validFrom, "->", cert.validTo);
  console.log(match ? "\nOK: chave privada corresponde ao certificado." : "\nERRO: chave privada NAO corresponde.");
  process.exit(match ? 0 : 1);
}

main();
