import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { CALENDARIO_ALVO_ROLES } from "../calendario-notas.util";

export class CreateCalendarioNotaDto {
  @IsEnum(["LEMBRETE", "EVENTO"])
  tipo!: "LEMBRETE" | "EVENTO";

  @IsString()
  @MaxLength(300)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  descricao?: string;

  /** ISO 8601 ou `YYYY-MM-DDTHH:mm` */
  @IsString()
  inicio!: string;

  @IsOptional()
  @IsString()
  fim?: string;

  @IsOptional()
  @IsUUID()
  entidadeClienteId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  alvoUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsIn([...CALENDARIO_ALVO_ROLES], { each: true })
  alvoRoles?: string[];
}

export class UpdateCalendarioNotaDto {
  @IsOptional()
  @IsEnum(["LEMBRETE", "EVENTO"])
  tipo?: "LEMBRETE" | "EVENTO";

  @IsOptional()
  @IsString()
  @MaxLength(300)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  descricao?: string;

  @IsOptional()
  @IsString()
  inicio?: string;

  @IsOptional()
  @IsString()
  fim?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== "")
  @IsUUID()
  entidadeClienteId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  alvoUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsIn([...CALENDARIO_ALVO_ROLES], { each: true })
  alvoRoles?: string[];
}
