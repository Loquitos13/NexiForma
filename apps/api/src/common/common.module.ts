import { Global, Module } from "@nestjs/common";
import { FormadorScopeService } from "./formador-scope.service";
import { HtmlPdfExportService } from "./html-pdf-export.service";

@Global()
@Module({
  providers: [FormadorScopeService, HtmlPdfExportService],
  exports: [FormadorScopeService, HtmlPdfExportService],
})
export class CommonModule {}
