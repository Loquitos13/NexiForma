import { Controller, Get, Header } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PUBLIC_OPENAPI_SPEC } from "./public-openapi.document";

@Controller("docs")
export class OpenApiController {
  @SkipThrottle()
  @Get("openapi.json")
  @Header("Content-Type", "application/json; charset=utf-8")
  spec() {
    return PUBLIC_OPENAPI_SPEC;
  }

  @SkipThrottle()
  @Get()
  docsRedirect() {
    return {
      openapi: "/v1/docs/openapi.json",
      publicApiBase: "/v1/public/v1",
      swaggerUi: "https://editor.swagger.io/?url=",
      hint: "Importe openapi.json no Swagger Editor ou Postman.",
    };
  }
}
