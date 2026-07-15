import { Controller, Get, Header } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { PUBLIC_OPENAPI_SPEC } from "./public-openapi.document";
import { TENANT_WEBSITE_SYNC_OPENAPI_SPEC } from "./tenant-website-sync.openapi.document";
import { FORMACOES_WEBSITE_INTEGRATION_OPENAPI_SPEC } from "./formacoes-website-integration.openapi.document";

@Public()
@Controller("docs")
export class OpenApiController {
  @SkipThrottle()
  @Get("openapi.json")
  @Header("Content-Type", "application/json; charset=utf-8")
  spec() {
    return PUBLIC_OPENAPI_SPEC;
  }

  @SkipThrottle()
  @Get("tenant-website-sync.openapi.json")
  @Header("Content-Type", "application/json; charset=utf-8")
  tenantWebsiteSyncSpec() {
    return TENANT_WEBSITE_SYNC_OPENAPI_SPEC;
  }

  @SkipThrottle()
  @Get("formacoes-website-integration.openapi.json")
  @Header("Content-Type", "application/json; charset=utf-8")
  formacoesIntegrationSpec() {
    return FORMACOES_WEBSITE_INTEGRATION_OPENAPI_SPEC;
  }

  @SkipThrottle()
  @Get()
  docsRedirect() {
    const docsPort = process.env.API_DOCS_PORT ?? "4001";
    const docsPublic =
      process.env.API_DOCS_PUBLIC_URL?.trim() ||
      `http://localhost:${docsPort}`;
    return {
      openapi: "/v1/docs/openapi.json",
      tenantWebsiteSyncOpenapi: "/v1/docs/tenant-website-sync.openapi.json",
      formacoesIntegrationOpenapi: "/v1/docs/formacoes-website-integration.openapi.json",
      publicApiBase: "/v1/public/v1",
      swaggerUi: `${docsPublic}/`,
      swaggerFormacoes: `${docsPublic}/formacoes`,
      swaggerTenantWebhook: `${docsPublic}/tenant-webhook`,
      hint: "Swagger UI interactivo no servidor de docs (API_DOCS_PORT). JSON também disponível em /v1/docs/*.openapi.json",
    };
  }
}
