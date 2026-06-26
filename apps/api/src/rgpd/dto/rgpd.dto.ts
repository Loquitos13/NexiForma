import { IsEnum, IsString, IsUUID } from "class-validator";
import type { RgpdPedidoTipo } from "@nexiforma/database";

const TIPOS = ["EXPORT", "DELETE"] as const;

export class CreateRgpdPedidoDto {
  @IsUUID()
  subjectId!: string;

  @IsString()
  subjectType!: string;

  @IsEnum(TIPOS)
  tipo!: RgpdPedidoTipo;
}
