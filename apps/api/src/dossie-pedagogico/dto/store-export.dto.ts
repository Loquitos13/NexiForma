import { IsIn } from "class-validator";
import type { ExportArquivoTipo } from "@nexiforma/database";

const TIPOS = ["DOSSIE_JSON", "SIGO_JSON", "DOSSIE_HTML", "INSPECAO_ZIP"] as const;

export class StoreExportDto {
  @IsIn(TIPOS)
  tipo!: ExportArquivoTipo;
}
