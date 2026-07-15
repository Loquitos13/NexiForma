#!/usr/bin/env node
/**
 * Servidor HTTP mock da API SIGO (DGEEC) para desenvolvimento local.
 *
 * Uso:
 *   node scripts/sigo-mock-api.mjs
 *   SIGO_API_MODE=http
 *   SIGO_API_BASE_URL=http://localhost:3099
 *   SIGO_API_KEY=dev-mock-key
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.SIGO_MOCK_PORT ?? "3099");
const API_KEY = process.env.SIGO_API_KEY ?? "dev-mock-key";

const MOCK_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n" +
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n" +
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj\n" +
    "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n" +
    "trailer<< /Root 1 0 R /Size 4 >>\nstartxref\n178\n%%EOF\n",
);

/** @type {Map<string, { reconcileCount: number; formandos: Array<{ nif: string; nome: string; matriculaId?: string }>; acaoCodigo: string }>} */
const store = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function authOk(req) {
  const h = req.headers.authorization ?? "";
  return h === `Bearer ${API_KEY}`;
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function extractFormandos(body) {
  if (Array.isArray(body.formandos)) return body.formandos;
  if (body.dgeec?.formandos) return body.dgeec.formandos;
  if (body.nexiforma?.formandos) return body.nexiforma.formandos;
  return [];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/health" && req.method === "GET") {
    return json(res, 200, { ok: true, service: "sigo-mock", submissions: store.size });
  }

  if (!authOk(req)) {
    return json(res, 401, { mensagem: "API key inválida." });
  }

  if (req.method === "POST" && path === "/acoes") {
    const raw = await readBody(req);
    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return json(res, 400, { mensagem: "JSON inválido." });
    }

    const ref = String(req.headers["x-nexiforma-reference"] ?? randomUUID());
    const acao = body.acaoFormacao ?? body.dgeec?.acaoFormacao ?? {};
    const codigo = acao.codigoInterno ?? acao.codigo ?? "ACAO";
    const formandos = extractFormandos(body).map((f) => ({
      nif: String(f.nif ?? "").replace(/\D/g, ""),
      nome: String(f.nome ?? "Formando"),
      matriculaId: f.matriculaId ?? f.matriculaExternaId ?? null,
    }));

    store.set(ref, { reconcileCount: 0, formandos, acaoCodigo: codigo });
    return json(res, 201, { id: ref, referenceId: ref, estado: "SUBMETIDA" });
  }

  const statusMatch = path.match(/^\/acoes\/([^/]+)$/);
  if (req.method === "GET" && statusMatch) {
    const ref = statusMatch[1];
    const row = store.get(ref);
    if (!row) return json(res, 404, { mensagem: "Submissão não encontrada." });
    if (row.reconcileCount < 1) {
      return json(res, 200, { id: ref, estado: "SUBMETIDA", mensagem: "Aguarda processamento." });
    }
    return json(res, 200, { id: ref, estado: "ACEITE", mensagem: "Aceite pela SIGO (mock)." });
  }

  const certsMatch = path.match(/^\/acoes\/([^/]+)\/certificados$/);
  if (req.method === "GET" && certsMatch) {
    const ref = certsMatch[1];
    const row = store.get(ref);
    if (!row || row.reconcileCount < 1) return json(res, 200, { certificados: [] });

    const emitidoEm = new Date().toISOString();
    const certificados = row.formandos.map((f) => {
      const certId = `mock-cert-${f.nif || randomUUID().slice(0, 8)}`;
      return {
        id: certId,
        referencia: certId,
        nif: f.nif,
        nome: f.nome,
        matriculaId: f.matriculaId,
        numeroCertificado: `SIGO-MOCK-${row.acaoCodigo}-${f.nif}`,
        estado: "DISPONIVEL",
        emitidoEm,
        downloadUrl: `/certificados/${certId}/download`,
      };
    });
    return json(res, 200, { certificados });
  }

  const downloadMatch = path.match(/^\/certificados\/([^/]+)\/download$/);
  if (req.method === "GET" && downloadMatch) {
    res.writeHead(200, { "content-type": "application/pdf" });
    return res.end(MOCK_PDF);
  }

  if (req.method === "POST" && statusMatch) {
    const ref = statusMatch[1];
    const row = store.get(ref);
    if (!row) return json(res, 404, { mensagem: "Submissão não encontrada." });
    row.reconcileCount += 1;
    return json(res, 200, { id: ref, estado: row.reconcileCount >= 1 ? "ACEITE" : "SUBMETIDA" });
  }

  json(res, 404, { mensagem: `Rota não encontrada: ${req.method} ${path}` });
});

server.listen(PORT, () => {
  console.log(`SIGO mock API em http://localhost:${PORT}`);
  console.log(`Bearer token: ${API_KEY}`);
  console.log("Endpoints: GET /health, POST /acoes, GET /acoes/:id, GET /acoes/:id/certificados, GET /certificados/:id/download");
});
