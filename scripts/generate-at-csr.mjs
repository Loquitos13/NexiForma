#!/usr/bin/env node
/**
 * Gera par .key + .csr (RSA 4096, SHA-256) para adesão AT Produtores de Software.
 * Não requer OpenSSL instalado - usa node-forge.
 *
 * Uso:
 *   npm run generate:at-csr -- --nif 515834963 --st Lisboa --city Lisboa \
 *     --org "Espiraleducada - Formacao e Consultoria Unipessoal Lda" \
 *     --ou "Forma Futuro" --email admin@formafuturoportugal.pt
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import forge from "node-forge";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const LIMITS = { C: 2, ST: 32, L: 32, O: 180, OU: 180, CN: 9, email: 80 };

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/** AT não aceita caracteres especiais / acentos nos campos CSR. */
function toAtAscii(value, field) {
  const normalized = String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7E]/g, "");
  const max = LIMITS[field] ?? 180;
  if (normalized.length > max) {
    console.warn(`Aviso: campo ${field} truncado a ${max} caracteres.`);
    return normalized.slice(0, max);
  }
  return normalized;
}

function usage() {
  console.log(`
Gera chave privada RSA 4096 + CSR para o portal AT (Produtores de Software).

npm run generate:at-csr -- \\
  --nif 515834963 \\
  --st Lisboa \\
  --city Lisboa \\
  --org "Espiraleducada - Formacao e Consultoria Unipessoal Lda" \\
  --ou "Forma Futuro" \\
  --email admin@formafuturoportugal.pt \\
  [--out ./certs/adesao]

Campos obrigatórios: --nif --st --city --org --ou --email
Sem acentos nos valores (serão removidos automaticamente se existirem).
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    process.exit(0);
  }

  const nifRaw = String(args.nif ?? "").replace(/\D/g, "");
  if (!/^\d{9}$/.test(nifRaw)) {
    console.error("Erro: --nif deve ter 9 dígitos.");
    usage();
    process.exit(1);
  }

  for (const key of ["st", "city", "org", "ou", "email"]) {
    if (!args[key]?.toString().trim()) {
      console.error(`Erro: --${key} é obrigatório.`);
      usage();
      process.exit(1);
    }
  }

  const attrs = {
    C: "PT",
    ST: toAtAscii(args.st, "ST"),
    L: toAtAscii(args.city, "L"),
    O: toAtAscii(args.org, "O"),
    OU: toAtAscii(args.ou, "OU"),
    CN: nifRaw,
  };
  const email = toAtAscii(args.email, "email");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Erro: email inválido.");
    process.exit(1);
  }

  const outDir = resolve(root, args.out ?? "./certs/adesao");
  mkdirSync(outDir, { recursive: true });

  const keys = forge.pki.rsa.generateKeyPair(4096);
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;

  csr.setSubject([
    { name: "countryName", value: attrs.C },
    { name: "stateOrProvinceName", value: attrs.ST },
    { name: "localityName", value: attrs.L },
    { name: "organizationName", value: attrs.O },
    { name: "organizationalUnitName", value: attrs.OU },
    { name: "commonName", value: attrs.CN },
    { name: "emailAddress", value: email },
  ]);

  csr.sign(keys.privateKey, forge.md.sha256.create());

  const keyPath = resolve(outDir, `${nifRaw}.key`);
  const csrPath = resolve(outDir, `${nifRaw}.csr`);

  writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey), "utf8");
  writeFileSync(csrPath, forge.pki.certificationRequestToPem(csr), "utf8");

  console.log("CSR AT gerado com sucesso (RSA 4096, SHA-256).\n");
  console.log("Ficheiros:");
  console.log(`  Chave privada (GUARDAR, nunca enviar): ${keyPath}`);
  console.log(`  CSR (colar no portal AT):               ${csrPath}\n`);
  console.log("Subject:");
  console.log(`  C=${attrs.C}, ST=${attrs.ST}, L=${attrs.L}`);
  console.log(`  O=${attrs.O}, OU=${attrs.OU}, CN=${attrs.CN}`);
  console.log(`  emailAddress=${email}\n`);
  console.log("--- Conteúdo do .csr (copiar para o portal) ---\n");
  console.log(forge.pki.certificationRequestToPem(csr));
  console.log("--- fim ---\n");
  console.warn(
    "IMPORTANTE: Guarde o .key em local seguro. Quando a AT enviar o .crt:\n" +
      `  npm run generate:at-pfx -- --nif ${nifRaw} --crt ./certs/adesao/${nifRaw}.crt`,
  );
}

main();
