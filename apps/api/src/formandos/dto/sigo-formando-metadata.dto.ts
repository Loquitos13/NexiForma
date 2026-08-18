import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { SIGO_HABILITACOES_CNQ } from "@nexiforma/shared";

const TIPOS_DOC = ["CC", "PAS", "BI", "C", "P"] as const;
const HABILITACOES = [...SIGO_HABILITACOES_CNQ] as string[];

/** Metadados SIGO/DGEEC do formando (guardados em `metadata.sigo`). */
export class SigoFormandoMetadataDto {
  @IsOptional()
  @IsIn(TIPOS_DOC)
  tipoDocIdentificacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  numDocIdentificacao?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "validadeDocumento deve ser AAAA-MM-DD" })
  validadeDocumento?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dataNascimento deve ser AAAA-MM-DD" })
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/i, { message: "nacionalidade deve ser código ISO-2 (ex: PT)" })
  nacionalidade?: string;

  @IsOptional()
  @IsIn(HABILITACOES)
  habilitacaoLiteraria?: string;
}
