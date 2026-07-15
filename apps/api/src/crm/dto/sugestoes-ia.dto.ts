import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { CRM_SUGESTAO_REJEICAO_MOTIVOS } from "@nexiforma/shared";

export class RejeitarSugestaoIaDto {
  @IsString()
  @IsIn([...CRM_SUGESTAO_REJEICAO_MOTIVOS])
  motivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comentario?: string;
}
