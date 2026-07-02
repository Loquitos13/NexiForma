#!/usr/bin/env node
/**
 * Combina certificado AT (.crt) + chave privada (.key) num .pfx para o NexiForma.
 * Não requer OpenSSL - usa node-forge.
 *
 * Uso:
 *   npm run generate:at-pfx -- --nif 515834963 --crt ./certs/adesao/515834963.crt --passphrase "sua-password"
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import forge from "node-forge";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

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

function readPem(path) {
  return readFileSync(path, "utf8");
}

function loadCert(pemOrPath) {
  const raw = existsSync(pemOrPath) ? readPem(pemOrPath) : pemOrPath;
  if (raw.includes("BEGIN CERTIFICATE")) {
    return forge.pki.certificateFromPem(raw);
  }
  const der = forge.util.decode64(raw.replace(/\s/g, ""));
  return forge.pki.certificateFromAsn1(forge.asn1.fromDer(der));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const nif = String(args.nif ?? "").replace(/\D/g, "");
  if (!/^\d{9}$/.test(nif)) {
    console.error("Erro: --nif deve ter 9 dígitos.");
    process.exit(1);
  }
  if (!args.crt) {
    console.error("Erro: --crt é obrigatório (ficheiro .crt recebido da AT).");
    process.exit(1);
  }

  const keyPath = resolve(root, args.key ?? `./certs/adesao/${nif}.key`);
  const crtPath = resolve(root, args.crt);
  const outPath = resolve(root, args.out ?? `./certs/at-producer-${nif}.pfx`);

  if (!existsSync(keyPath)) {
    console.error(`Erro: chave privada não encontrada: ${keyPath}`);
    process.exit(1);
  }
  if (!existsSync(crtPath)) {
    console.error(`Erro: certificado não encontrado: ${crtPath}`);
    process.exit(1);
  }

  let passphrase = args.passphrase?.toString() ?? "";
  if (!passphrase) {
    const rl = createInterface({ input, output });
    passphrase = await rl.question("Password para o ficheiro .pfx: ");
    await rl.close();
  }
  if (!passphrase.trim()) {
    console.error("Erro: password do PFX em falta.");
    process.exit(1);
  }

  const privateKey = forge.pki.privateKeyFromPem(readPem(keyPath));
  const cert = loadCert(crtPath);

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], passphrase, {
    algorithm: "3des",
  });
  const pfxDer = forge.asn1.toDer(p12Asn1).getBytes();
  writeFileSync(outPath, Buffer.from(pfxDer, "binary"));

  console.log("PFX criado:", outPath);
  console.log("\nConfigure no .env:");
  console.log(`AT_FATURAS_CLIENT_CERT_PFX_PATH=./certs/at-producer-${nif}.pfx`);
  console.log(`AT_FATURAS_CLIENT_CERT_PASSPHRASE=<a password que definiu>`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
