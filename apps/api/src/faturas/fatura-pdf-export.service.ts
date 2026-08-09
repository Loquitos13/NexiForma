import { Injectable } from "@nestjs/common";
import { HtmlPdfExportService } from "../common/html-pdf-export.service";

@Injectable()
export class FaturaPdfExportService {
  constructor(private readonly htmlPdf: HtmlPdfExportService) {}

  /** Margens mínimas para caber numa página A4 e aproveitar a folha. */
  htmlToPdfBuffer(html: string): Promise<Buffer> {
    return this.htmlPdf.htmlToPdfBuffer(html, {
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
  }
}
