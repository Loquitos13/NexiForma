/**
 * OpenAPI - APIs NexiForma para integração do website do tenant
 * (pull via API key + gestão webhook no portal JWT).
 */
export const FORMACOES_WEBSITE_INTEGRATION_OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "NexiForma API - Formações & Website Sync",
    version: "1.0.0",
    description:
      "APIs NexiForma que permitem sincronizar o catálogo de formações com o website do tenant.\n\n" +
      "## Modos de integração\n" +
      "1. **Webhook (push)** - NexiForma envia POST para o website (ver spec *Tenant Webhook*).\n" +
      "2. **Pull** - website consome `GET /public/v1/formacoes/*` com `X-Api-Key`.\n" +
      "3. **Portal** - gestor configura webhook em `PATCH /formacoes/website/config` (JWT).\n\n" +
      "Chave API: Portal → Enterprise → API Keys (`nf_live_...`).",
  },
  servers: [
    { url: "https://api.nexiforma.pt/v1", description: "Produção" },
    { url: "http://localhost:4000/v1", description: "Desenvolvimento local" },
  ],
  tags: [
    { name: "Catálogo público", description: "Pull do catálogo (API key)" },
    { name: "Website sync", description: "Configuração webhook no portal (JWT)" },
  ],
  paths: {
    "/public/v1/formacoes/catalogo": {
      get: {
        tags: ["Catálogo público"],
        operationId: "getCatalogoPaginado",
        summary: "Catálogo paginado (recomendado)",
        description: "Retorna formações publicadas com acções e sessões. Cache `max-age=120`.",
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: "after",
            in: "query",
            description: "codigoPublico cursor (paginação)",
            schema: { type: "integer", minimum: 1 },
          },
        ],
        responses: {
          "200": {
            description: "Página do catálogo",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CatalogPageResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedApiKey" },
          "429": { $ref: "#/components/responses/TooManyRequests" },
        },
      },
    },
    "/public/v1/formacoes": {
      get: {
        tags: ["Catálogo público"],
        operationId: "listFormacoesPublicas",
        summary: "Listar todas as formações publicadas",
        security: [{ ApiKeyAuth: [] }],
        responses: {
          "200": {
            description: "Lista completa (sem paginação)",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/FormacaoPublica" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedApiKey" },
        },
      },
    },
    "/public/v1/formacoes/{codigoPublico}": {
      get: {
        tags: ["Catálogo público"],
        operationId: "getFormacaoPublica",
        summary: "Detalhe de uma formação",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CodigoPublico" }],
        responses: {
          "200": {
            description: "Formação com acções",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FormacaoPublica" },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedApiKey" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/public/v1/formacoes/{codigoPublico}/acoes": {
      get: {
        tags: ["Catálogo público"],
        operationId: "listAcoesPublicas",
        summary: "Acções publicadas de uma formação",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CodigoPublico" }],
        responses: {
          "200": {
            description: "Lista de acções",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/AcaoPublica" },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedApiKey" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/public/v1/formacoes/{codigoPublico}/capa": {
      get: {
        tags: ["Catálogo público"],
        operationId: "getCapaFormacao",
        summary: "Imagem de capa",
        security: [{ ApiKeyAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/CodigoPublico" }],
        responses: {
          "200": {
            description: "Binário da imagem",
            content: {
              "image/jpeg": { schema: { type: "string", format: "binary" } },
              "image/png": { schema: { type: "string", format: "binary" } },
              "image/webp": { schema: { type: "string", format: "binary" } },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedApiKey" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/formacoes/website/config": {
      get: {
        tags: ["Website sync"],
        operationId: "getWebsiteSyncConfig",
        summary: "Obter configuração de sync webhook",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Estado actual do webhook",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebsiteSyncConfigResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedJwt" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
      patch: {
        tags: ["Website sync"],
        operationId: "updateWebsiteSyncConfig",
        summary: "Actualizar webhook (tenant_manager)",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateWebsiteSyncDto" },
            },
          },
        },
        responses: {
          "200": {
            description: "Configuração actualizada",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebsiteSyncConfigResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequest" },
          "401": { $ref: "#/components/responses/UnauthorizedJwt" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
    "/formacoes/website/sync": {
      post: {
        tags: ["Website sync"],
        operationId: "triggerFullCatalogSync",
        summary: "Disparar sync completo para o webhook",
        description: "Envia `catalog.full_sync` para o webhook configurado.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Resultado do envio",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebsiteSyncTriggerResponse" },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedJwt" },
          "403": { $ref: "#/components/responses/Forbidden" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Api-Key",
        description: "Chave API do tenant (`nf_live_...`)",
      },
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Access token do portal NexiForma",
      },
    },
    parameters: {
      CodigoPublico: {
        name: "codigoPublico",
        in: "path",
        required: true,
        schema: { type: "integer", minimum: 1 },
        description: "ID sequencial público da formação",
      },
    },
    responses: {
      UnauthorizedApiKey: {
        description: "API key inválida ou em falta",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
            example: { statusCode: 401, message: "API key inválida", error: "Unauthorized" },
          },
        },
      },
      UnauthorizedJwt: {
        description: "JWT inválido ou expirado",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
            example: { statusCode: 401, message: "Unauthorized", error: "Unauthorized" },
          },
        },
      },
      Forbidden: {
        description: "Sem permissão (role insuficiente)",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
            example: { statusCode: 403, message: "Forbidden resource", error: "Forbidden" },
          },
        },
      },
      NotFound: {
        description: "Recurso não encontrado",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
            example: { statusCode: 404, message: "Formação não encontrada", error: "Not Found" },
          },
        },
      },
      BadRequest: {
        description: "Validação falhou",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
          },
        },
      },
      TooManyRequests: {
        description: "Rate limit excedido",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
            example: { statusCode: 429, message: "ThrottlerException", error: "Too Many Requests" },
          },
        },
      },
    },
    schemas: {
      CatalogPageResponse: {
        type: "object",
        required: ["items", "pageInfo"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/FormacaoPublica" },
          },
          pageInfo: { $ref: "#/components/schemas/CatalogPageInfo" },
        },
      },
      CatalogPageInfo: {
        type: "object",
        required: ["hasMore", "nextCursor", "limit"],
        properties: {
          hasMore: { type: "boolean" },
          nextCursor: { type: "integer", nullable: true },
          limit: { type: "integer" },
        },
      },
      FormacaoPublica: {
        type: "object",
        required: ["titulo", "horas", "publicado"],
        properties: {
          id: { type: "integer", nullable: true },
          uuid: { type: "string", format: "uuid" },
          titulo: { type: "string", maxLength: 280 },
          horas: { type: "integer", minimum: 1 },
          ufcd: { type: "string", nullable: true },
          enquadramento: { type: "string", nullable: true },
          objetivos: { type: "string", nullable: true },
          metodoEnsino: { type: "string", nullable: true },
          modalidade: { type: "string" },
          publicado: { type: "boolean" },
          capaUrl: { type: "string", format: "uri", nullable: true },
          acoes: { type: "array", items: { $ref: "#/components/schemas/AcaoPublica" } },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      AcaoPublica: {
        type: "object",
        required: [
          "id",
          "codigoInterno",
          "titulo",
          "dataInicio",
          "dataFim",
          "inscricoes",
          "publicado",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          codigoInterno: { type: "string" },
          titulo: { type: "string" },
          dataInicio: { type: "string", format: "date" },
          dataFim: { type: "string", format: "date" },
          estado: { type: "string" },
          inscricoes: { type: "string", enum: ["ABERTAS", "FECHADAS"] },
          publicado: { type: "boolean" },
          inscritos: { type: "integer", minimum: 0 },
          agenda: { type: "object", additionalProperties: true },
          sessoes: { type: "array", items: { $ref: "#/components/schemas/SessaoPublica" } },
        },
      },
      SessaoPublica: {
        type: "object",
        required: ["id", "numero", "data", "horaInicio", "horaFim"],
        properties: {
          id: { type: "string", format: "uuid" },
          numero: { type: "integer" },
          data: { type: "string", format: "date" },
          horaInicio: { type: "string" },
          horaFim: { type: "string" },
          local: { type: "string", nullable: true },
          estado: { type: "string" },
        },
      },
      WebsiteSyncConfigResponse: {
        type: "object",
        required: ["enabled", "webhookUrl", "hasSecret"],
        properties: {
          enabled: { type: "boolean" },
          webhookUrl: { type: "string" },
          hasSecret: { type: "boolean" },
          lastSyncAt: { type: "string", format: "date-time", nullable: true },
          lastSyncStatus: { type: "string", enum: ["ok", "error"], nullable: true },
          lastSyncError: { type: "string", nullable: true },
        },
      },
      UpdateWebsiteSyncDto: {
        type: "object",
        properties: {
          enabled: { type: "boolean" },
          webhookUrl: { type: "string", maxLength: 2048 },
          webhookSecret: { type: "string", maxLength: 256 },
        },
      },
      WebsiteSyncTriggerResponse: {
        type: "object",
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
          skipped: { type: "boolean" },
          reason: { type: "string" },
          error: { type: "string" },
        },
      },
      ApiErrorResponse: {
        type: "object",
        properties: {
          statusCode: { type: "integer" },
          message: { type: "string" },
          error: { type: "string" },
        },
      },
      ValidationErrorResponse: {
        type: "object",
        properties: {
          statusCode: { type: "integer", example: 400 },
          message: { type: "array", items: { type: "string" } },
          error: { type: "string", example: "Bad Request" },
        },
      },
    },
  },
} as const;
