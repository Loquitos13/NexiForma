import { Injectable } from "@nestjs/common";

import { HtmlPdfExportService } from "../common/html-pdf-export.service";



@Injectable()

export class FaturaPdfExportService {

  constructor(private readonly htmlPdf: HtmlPdfExportService) {}



  htmlToPdfBuffer(html: string): Promise<Buffer> {

    return this.htmlPdf.htmlToPdfBuffer(html);

  }

}

