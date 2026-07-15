import { Global, Module } from "@nestjs/common";
import { FormadorScopeService } from "./formador-scope.service";
import { HtmlPdfExportService } from "./html-pdf-export.service";
import { HttpQueryMethodGuard } from "./http-query.guard";

@Global()
@Module({
  providers: [FormadorScopeService, HtmlPdfExportService, HttpQueryMethodGuard],
  exports: [FormadorScopeService, HtmlPdfExportService, HttpQueryMethodGuard],
})
export class CommonModule {}
