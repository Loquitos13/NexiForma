/**
 * Teste de ligação à sandbox REAL da AT (portas 700 / 722).
 *
 * Credenciais demo AT: NIF 599999993, subutilizador 37, password testes1234
 *
 *   npx tsx scripts/test-at-sandbox.ts faturas
 *   npx tsx scripts/test-at-sandbox.ts series
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { AT_FATURAS_ENDPOINTS, AT_SOAP_ACTION_REGISTER } from "../apps/api/src/faturas/at-faturas-constants";
import { formatarUsernameWfa } from "../apps/api/src/faturas/at-faturas-credentials.util";
import { postAtSoapRequest, loadAtTlsMaterial } from "../apps/api/src/faturas/at-faturas-http.util";
import { buildRegisterInvoiceSoapEnvelope } from "../apps/api/src/faturas/at-faturas-payload.util";
import { parseAtFaturasSoapResponse } from "../apps/api/src/faturas/at-faturas-response.util";
import { buildAtSecurityHeaderFields } from "../apps/api/src/faturas/at-faturas-security.util";
import { cerPublicKeyToPem } from "../apps/api/src/faturas/at-integration.util";
import { buildRegistarSerieSoapEnvelope } from "../apps/api/src/faturas/at-series-payload.util";
import { parseAtSeriesSoapResponse } from "../apps/api/src/faturas/at-series-response.util";
import { AT_SERIES_ENDPOINTS, AT_SERIES_SOAP_ACTION } from "../apps/api/src/faturas/at-series-constants";

const root = resolve(import.meta.dirname ?? ".", "..");
const target = process.argv[2] ?? "faturas";

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function loadPublicKeyPem(): string {
  const path = resolve(root, env("AT_FATURAS_PUBLIC_KEY_PATH", "./certs/at-public-key.pem"));
  if (!existsSync(path)) {
    throw new Error(`Chave pública AT em falta: ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  if (raw.includes("BEGIN PUBLIC KEY")) return raw;
  if (path.toLowerCase().endsWith(".cer")) return cerPublicKeyToPem(path);
  return raw;
}

const nif = env("AT_TEST_NIF", "599999993");
const sub = env("AT_TEST_SUBUSER", "37");
const password = env("AT_TEST_PASSWORD", "testes1234");
const swCert = env("AT_SOFTWARE_CERT_NUMBER", "9999");

const tls = loadAtTlsMaterial({
  pemPath: env("AT_FATURAS_CLIENT_CERT_PEM_PATH"),
  pfxPath: resolve(root, env("AT_FATURAS_CLIENT_CERT_PFX_PATH", "./certs/TesteWebservices.pfx")),
  pfxPassphrase: env("AT_FATURAS_CLIENT_CERT_PASSPHRASE", "TESTEwebservice"),
});

if (!tls) {
  console.error("Certificado TesteWebservices.pfx em falta em ./certs/");
  process.exit(1);
}

const pubKey = loadPublicKeyPem();
const username = formatarUsernameWfa(nif, sub);
const security = buildAtSecurityHeaderFields(username, password, pubKey);

async function main() {
  console.log(`AT sandbox REAL – ${target}`);
  console.log(`  Utilizador: ${username}`);

  if (target === "series") {
  const endpoint = env("AT_SERIES_ENDPOINT", AT_SERIES_ENDPOINTS.sandbox);
  const serie = `T${Date.now().toString(36).slice(-5).toUpperCase()}`;
  const envelope = buildRegistarSerieSoapEnvelope(security, {
    serie,
    tipoDocumento: "FT",
    numInicialSeq: 1,
    dataInicioPrevUtiliz: new Date(),
    numCertSWFatur: swCert,
  });
  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Série: ${serie}`);
  const res = await postAtSoapRequest(endpoint, AT_SERIES_SOAP_ACTION, envelope, {
    timeoutMs: 45_000,
    tls,
  });
  const parsed = parseAtSeriesSoapResponse(res.body);
  console.log(`  HTTP ${res.statusCode} | sucesso=${parsed.sucesso} | código=${parsed.codigoResposta}`);
  console.log(`  ${parsed.mensagemAt}`);
  if (parsed.codigoValidacao) console.log(`  Código validação: ${parsed.codigoValidacao}`);
  if (!parsed.sucesso) {
    console.log("\n--- SOAP ---\n", res.body.slice(0, 2500));
    process.exit(1);
  }
} else {
  const endpoint = env("AT_FATURAS_ENDPOINT", AT_FATURAS_ENDPOINTS.sandbox);
  const numero = Math.floor(Date.now() / 1000) % 900_000 + 100_000;
  const doc = {
    nifEmitente: nif,
    nifCliente: nif,
    tipoDocumento: "FT",
    serie: "SANDBOX",
    numero,
    atcud: `9999SANDBOX-${numero}`,
    dataEmissao: new Date(),
    valorCentavos: 100,
    ivaCentavos: 23,
    moeda: "EUR",
    invoiceStatus: "N" as const,
    softwareCertificado: swCert,
    linhas: [
      {
        descricao: "Teste NexiForma sandbox AT",
        quantidade: 1,
        precoUnitCentavos: 100,
        taxaIva: 23,
        valorIvaCentavos: 23,
      },
    ],
  };
  const envelope = buildRegisterInvoiceSoapEnvelope(security, doc);
  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Documento: FT SANDBOX/${numero}`);
  const res = await postAtSoapRequest(endpoint, AT_SOAP_ACTION_REGISTER, envelope, {
    timeoutMs: 45_000,
    tls,
  });
  const parsed = parseAtFaturasSoapResponse(res.body);
  console.log(`  HTTP ${res.statusCode} | sucesso=${parsed.sucesso} | código=${parsed.codigoResposta}`);
  console.log(`  ${parsed.mensagemAt}`);
  if (!parsed.sucesso) {
    console.log("\n--- SOAP ---\n", res.body.slice(0, 2500));
    process.exit(1);
  }
}

  console.log("\nLigação à sandbox AT OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
