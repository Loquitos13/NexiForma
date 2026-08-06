import { IsIn, IsOptional } from "class-validator";
import { RGPD_EXPORT_FORMATS } from "../rgpd-export-format.util";

export class ExportSelfDto {
  @IsOptional()
  @IsIn([...RGPD_EXPORT_FORMATS])
  format?: (typeof RGPD_EXPORT_FORMATS)[number];
}
