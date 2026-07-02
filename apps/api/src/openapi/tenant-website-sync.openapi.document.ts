/** OpenAPI 3.0 - contrato que o website do tenant deve implementar (webhook). */
export const TENANT_WEBSITE_SYNC_OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "NexiForma → Website do Tenant (Webhook Sync)",
    version: "1.0.0",
    description:
      "Contrato que o **website do tenant** deve implementar para receber actualizações " +
      "do catálogo de formações publicadas na NexiForma.\n\n" +
      "## Configuração na NexiForma\n" +
      "Portal → **Formações website** → activar webhook, URL deste endpoint e segredo HMAC.\n\n" +
      "## Envio (NexiForma → tenant)\n" +
      "- Método: `POST`\n" +
      "- `Content-Type: application/json`\n" +
      "- `User-Agent: NexiForma-WebsiteSync/1.0`\n" +
      "- `X-NexiForma-Signature: sha256=<hmac_hex>` (se segredo configurado)\n\n" +
      "### Verificação HMAC\n" +
      "```\nexpected = HMAC-SHA256(webhookSecret, rawBodyUtf8).hex\n" +
      "header   = X-NexiForma-Signature  // formato sha256= + expected\n```\n" +
      "Compare em tempo constante. Use o corpo bruto antes de fazer parse JSON.\n\n" +
      "## Resposta esperada\n" +
      "- `200` ou `204` → sync OK\n" +
      "- `4xx` / `5xx` → erro registado em Formações website → Último sync",
  },
  servers: [
    {
      url: "https://{websiteHost}",
      description: "Website do tenant (implementação obrigatória)",
      variables: {
        websiteHost: { default: "www.exemplo.pt", description: "Domínio público do website" },
      },
    },
  ],
  tags: [{ name: "Webhook", description: "Endpoint que o tenant expõe para a NexiForma" }],
  paths: {
    "/api/nexiforma/webhook": {
      post: {
        tags: ["Webhook"],
        operationId: "receberSyncNexiForma",
        summary: "Receber actualização do catálogo NexiForma",
        description:
          "Implemente este endpoint no backend do website. A URL completa é configurada " +
          "em NexiForma (ex. https://www.exemplo.pt/api/nexiforma/webhook).",
        parameters: [
          { $ref: "#/components/parameters/NexiFormaSignature" },
          { $ref: "#/components/parameters/UserAgent" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WebhookSyncPayload" },
            },
          },
        },
        responses: {
          "200": {
            description: "Payload aceite e processado",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebhookAckResponse" },
              },
            },
          },
          "204": { description: "Payload aceite sem corpo de resposta" },
          "400": {
            description: "JSON inválido ou campos obrigatórios em falta",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } },
            },
          },
          "401": {
            description: "Assinatura HMAC inválida ou em falta",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } },
            },
          },
          "405": {
            description: "Método HTTP não permitido (apenas POST)",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } },
            },
          },
          "413": {
            description: "Payload demasiado grande",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } },
            },
          },
          "422": {
            description: "Payload JSON válido mas regras de negócio rejeitadas",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
              },
            },
          },
          "500": {
            description: "Erro interno ao persistir catálogo",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } },
            },
          },
          "503": {
            description: "Serviço temporariamente indisponível",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ApiErrorResponse" } },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      NexiFormaSignature: {
        name: "X-NexiForma-Signature",
        in: "header",
        required: false,
        description:
          "HMAC-SHA256 do corpo JSON bruto. Formato sha256=<hex>. " +
          "Obrigatório quando webhookSecret está configurado na NexiForma.",
        schema: {
          type: "string",
          pattern: "^sha256=[a-f0-9]{64}$",
        },
      },
      UserAgent: {
        name: "User-Agent",
        in: "header",
        required: false,
        schema: { type: "string", example: "NexiForma-WebsiteSync/1.0" },
      },
    },
    schemas: {
      WebhookSyncEvent: {
        type: "string",
        enum: [
          "catalog.full_sync",
          "formacao.created",
          "formacao.updated",
          "formacao.published",
          "formacao.unpublished",
          "acao.created",
          "acao.updated",
          "acao.published",
        ],
      },
      InscricoesEstado: { type: "string", enum: ["ABERTAS", "FECHADAS"] },
      AcaoEstado: {
        type: "string",
        enum: ["PLANEADA", "EM_CURSO", "CONCLUIDA", "CANCELADA"],
      },
      SessaoEstado: { type: "string", enum: ["AGENDADA", "REALIZADA", "CANCELADA"] },
      WebhookSyncPayload: {
        type: "object",
        required: ["event", "tenantId", "timestamp"],
        properties: {
          event: { $ref: "#/components/schemas/WebhookSyncEvent" },
          tenantId: { type: "string", format: "uuid" },
          timestamp: { type: "string", format: "date-time" },
          catalog: { $ref: "#/components/schemas/CatalogFullSync" },
          formacao: { $ref: "#/components/schemas/FormacaoPublica" },
        },
        description:
          "catalog.full_sync inclui catalog; demais eventos incluem formacao " +
          "(formacao.unpublished pode enviar apenas uuid + publicado: false).",
      },
      CatalogFullSync: {
        type: "object",
        required: ["formacoes", "total"],
        properties: {
          formacoes: {
            type: "array",
            items: { $ref: "#/components/schemas/FormacaoPublica" },
          },
          total: { type: "integer", minimum: 0, description: "Máx. 500 por sync" },
        },
      },
      FormacaoPublica: {
        type: "object",
        required: ["titulo", "horas", "publicado"],
        properties: {
          id: {
            type: "integer",
            nullable: true,
            description: "codigoPublico sequencial (ID visível no website)",
          },
          uuid: { type: "string", format: "uuid" },
          titulo: { type: "string", maxLength: 280 },
          horas: { type: "integer", minimum: 1 },
          ufcd: { type: "string", nullable: true, maxLength: 32 },
          enquadramento: { type: "string", nullable: true },
          objetivos: { type: "string", nullable: true },
          metodoEnsino: { type: "string", nullable: true },
          modalidade: { type: "string", description: "presencial | b-learning | e-learning" },
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
          codigoInterno: { type: "string", maxLength: 64 },
          titulo: { type: "string", maxLength: 280 },
          dataInicio: { type: "string", format: "date" },
          dataFim: { type: "string", format: "date" },
          estado: { $ref: "#/components/schemas/AcaoEstado" },
          inscricoes: { $ref: "#/components/schemas/InscricoesEstado" },
          publicado: { type: "boolean" },
          inscritos: { type: "integer", minimum: 0 },
          agenda: { $ref: "#/components/schemas/AgendaTemplate" },
          sessoes: { type: "array", items: { $ref: "#/components/schemas/SessaoPublica" } },
        },
      },
      SessaoPublica: {
        type: "object",
        required: ["id", "numero", "data", "horaInicio", "horaFim"],
        properties: {
          id: { type: "string", format: "uuid" },
          numero: { type: "integer", minimum: 1 },
          data: { type: "string", format: "date" },
          horaInicio: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          horaFim: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          local: { type: "string", nullable: true, maxLength: 500 },
          estado: { $ref: "#/components/schemas/SessaoEstado" },
        },
      },
      AgendaTemplate: {
        type: "object",
        required: ["dataInicio", "dataFim", "horaInicio", "horaFim", "inscricoes"],
        properties: {
          dataInicio: { type: "string", format: "date" },
          dataFim: { type: "string", format: "date" },
          horaInicio: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          horaFim: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          repete: { type: "boolean", default: false },
          diasRepete: {
            type: "array",
            description: "0=domingo … 6=sábado",
            items: { type: "integer", minimum: 0, maximum: 6 },
          },
          local: { type: "string", nullable: true },
          inscricoes: { $ref: "#/components/schemas/InscricoesEstado" },
        },
      },
      WebhookAckResponse: {
        type: "object",
        required: ["received"],
        properties: {
          received: { type: "boolean", enum: [true] },
          event: { $ref: "#/components/schemas/WebhookSyncEvent" },
          processedAt: { type: "string", format: "date-time" },
        },
      },
      ApiErrorResponse: {
        type: "object",
        required: ["error", "message"],
        properties: {
          error: { type: "string", example: "bad_request" },
          message: { type: "string" },
        },
      },
      ValidationErrorResponse: {
        allOf: [
          { $ref: "#/components/schemas/ApiErrorResponse" },
          {
            type: "object",
            required: ["details"],
            properties: {
              error: { type: "string", enum: ["validation_error"] },
              details: {
                type: "array",
                minItems: 1,
                items: { $ref: "#/components/schemas/FieldError" },
              },
            },
          },
        ],
      },
      FieldError: {
        type: "object",
        required: ["field", "message"],
        properties: {
          field: { type: "string", example: "formacao.titulo" },
          message: { type: "string" },
        },
      },
    },
  },
} as const;
