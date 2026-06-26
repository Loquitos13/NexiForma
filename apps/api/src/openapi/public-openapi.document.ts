export const PUBLIC_OPENAPI_SPEC = {
  openapi: "3.0.3",
  info: {
    title: "NexiForma API pública",
    version: "1.0.0",
    description:
      "API REST para integrações enterprise (ERP, BI, portais cliente). Autenticação via header `X-Api-Key: nf_live_...`.",
  },
  servers: [{ url: "/v1/public/v1", description: "API pública por tenant" }],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "X-Api-Key",
      },
    },
    schemas: {
      Curso: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          designacao: { type: "string" },
          codigoUfcd: { type: "string", nullable: true },
          cargaHoras: { type: "integer" },
        },
      },
      AcaoFormacao: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          codigoInterno: { type: "string" },
          estado: { type: "string" },
          dataInicio: { type: "string", format: "date-time", nullable: true },
          dataFim: { type: "string", format: "date-time", nullable: true },
          curso: {
            type: "object",
            properties: { designacao: { type: "string" } },
          },
        },
      },
      Proposta: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          codigo: { type: "string" },
          titulo: { type: "string" },
          estado: { type: "string" },
          valorCentavos: { type: "integer" },
        },
      },
      Fatura: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          numero: { type: "integer", nullable: true },
          codigoAtcud: { type: "string", nullable: true },
          estado: { type: "string" },
          valorCentavos: { type: "integer" },
          dataEmissao: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        security: [],
        responses: { "200": { description: "OK" } },
      },
    },
    "/cursos": {
      get: {
        summary: "Listar cursos do tenant",
        responses: {
          "200": {
            description: "Lista de cursos",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Curso" } },
              },
            },
          },
        },
      },
    },
    "/acoes-formacao": {
      get: {
        summary: "Listar acções de formação",
        responses: {
          "200": {
            description: "Lista de acções",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/AcaoFormacao" } },
              },
            },
          },
        },
      },
    },
    "/propostas": {
      get: {
        summary: "Listar propostas comerciais",
        responses: {
          "200": {
            description: "Lista de propostas",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Proposta" } },
              },
            },
          },
        },
      },
    },
    "/faturas": {
      get: {
        summary: "Listar faturas emitidas/comunicadas",
        responses: {
          "200": {
            description: "Lista de faturas",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Fatura" } },
              },
            },
          },
        },
      },
    },
    "/matriculas": {
      get: {
        summary: "Listar matrículas activas",
        responses: { "200": { description: "Lista de matrículas" } },
      },
    },
  },
} as const;
