import express from "express";
import swaggerUi from "swagger-ui-express";
import { FORMACOES_WEBSITE_INTEGRATION_OPENAPI_SPEC } from "./openapi/formacoes-website-integration.openapi.document";
import { PUBLIC_OPENAPI_SPEC } from "./openapi/public-openapi.document";
import { TENANT_WEBSITE_SYNC_OPENAPI_SPEC } from "./openapi/tenant-website-sync.openapi.document";

type OpenApiSpec = Record<string, unknown>;

const SPECS: Array<{
  id: string;
  title: string;
  description: string;
  spec: OpenApiSpec;
  swaggerPath: string;
  jsonPath: string;
}> = [
  {
    id: "formacoes",
    title: "Formações & Website Sync",
    description: "API NexiForma - pull catálogo (API key) + config webhook (JWT)",
    spec: FORMACOES_WEBSITE_INTEGRATION_OPENAPI_SPEC as unknown as OpenApiSpec,
    swaggerPath: "/formacoes",
    jsonPath: "/openapi/formacoes-website-integration.json",
  },
  {
    id: "tenant-webhook",
    title: "Webhook do website (tenant)",
    description: "Contrato que o website do tenant deve implementar (POST webhook)",
    spec: TENANT_WEBSITE_SYNC_OPENAPI_SPEC as unknown as OpenApiSpec,
    swaggerPath: "/tenant-webhook",
    jsonPath: "/openapi/tenant-website-sync.json",
  },
  {
    id: "public",
    title: "API pública enterprise",
    description: "ERP, BI, cursos, acções, propostas, faturas",
    spec: PUBLIC_OPENAPI_SPEC as unknown as OpenApiSpec,
    swaggerPath: "/public",
    jsonPath: "/openapi/public.json",
  },
];

function apiBaseUrl(): string {
  const fromEnv = process.env.API_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.API_PORT ?? "4000";
  return `http://localhost:${port}`;
}

function docsPublicUrl(port: number): string {
  const fromEnv = process.env.API_DOCS_PUBLIC_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `http://localhost:${port}`;
}

function patchIntegrationServers(spec: OpenApiSpec): OpenApiSpec {
  if (spec !== (FORMACOES_WEBSITE_INTEGRATION_OPENAPI_SPEC as unknown as OpenApiSpec)) {
    return spec;
  }
  const base = apiBaseUrl();
  return {
    ...spec,
    servers: [
      { url: `${base}/v1`, description: "NexiForma API (produção/dev)" },
    ],
  };
}

function patchPublicServers(spec: OpenApiSpec): OpenApiSpec {
  if (spec !== (PUBLIC_OPENAPI_SPEC as unknown as OpenApiSpec)) {
    return spec;
  }
  const base = apiBaseUrl();
  return {
    ...spec,
    servers: [{ url: `${base}/v1/public/v1`, description: "API pública por tenant" }],
  };
}

function resolveSpec(raw: OpenApiSpec): OpenApiSpec {
  if (raw === (FORMACOES_WEBSITE_INTEGRATION_OPENAPI_SPEC as unknown as OpenApiSpec)) {
    return patchIntegrationServers(raw);
  }
  if (raw === (PUBLIC_OPENAPI_SPEC as unknown as OpenApiSpec)) {
    return patchPublicServers(raw);
  }
  return raw;
}

function landingHtml(baseUrl: string, apiUrl: string): string {
  const cards = SPECS.map(
    (s) => `
    <article class="card">
      <h2>${s.title}</h2>
      <p>${s.description}</p>
      <p>
        <a href="${baseUrl}${s.swaggerPath}">Swagger UI</a>
        · <a href="${baseUrl}${s.jsonPath}">OpenAPI JSON</a>
      </p>
    </article>`,
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>NexiForma API Docs</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; color: #1e293b; }
    h1 { font-size: 1.5rem; }
    .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
    .card h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
    .card p { margin: 0.35rem 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>NexiForma API - Documentação</h1>
  <p class="meta">Base API: <code>${apiUrl}</code> · Futuro: <code>https://api.nexiforma.pt</code></p>
  ${cards}
</body>
</html>`;
}

async function bootstrap() {
  const app = express();
  const port = Number(process.env.API_DOCS_PORT ?? 4001);
  const publicBase = docsPublicUrl(port);
  const apiUrl = apiBaseUrl();

  for (const entry of SPECS) {
    const spec = resolveSpec(entry.spec);
    app.get(entry.jsonPath, (_req, res) => {
      res.json(spec);
    });
    app.use(
      entry.swaggerPath,
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customSiteTitle: `NexiForma - ${entry.title}`,
        swaggerOptions: { persistAuthorization: true },
      }),
    );
  }

  app.get("/", (_req, res) => {
    res.type("html").send(landingHtml(publicBase, apiUrl));
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "nexiforma-api-docs" });
  });

  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // eslint-disable-next-line no-console
  console.log(`NexiForma API Docs em ${publicBase}/`);
  // eslint-disable-next-line no-console
  console.log(`  Formações: ${publicBase}/formacoes`);
}

void bootstrap().catch((err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    const port = process.env.API_DOCS_PORT ?? 4001;
    // eslint-disable-next-line no-console
    console.error(
      `Porta ${port} já está em uso. Feche o processo anterior ou defina API_DOCS_PORT noutra porta.\n` +
        `  PowerShell: Get-NetTCPConnection -LocalPort ${port} | Select OwningProcess`,
    );
    process.exit(1);
  }
  throw err;
});
