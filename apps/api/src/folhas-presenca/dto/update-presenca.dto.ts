import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { ESTADOS_PRESENCA } from "@nexiforma/shared";

export class UpdatePresencaDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(ESTADOS_PRESENCA)
  estado?: (typeof ESTADOS_PRESENCA)[number] | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivoJustificacao?: string | null;

  /** @deprecated Preferir `estado`. Mantido para compatibilidade LMS. */
  @IsOptional()
  @IsBoolean()
  presente?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minutosEfetivos?: number | null;

  @IsOptional()
  @IsBoolean()
  validado?: boolean;
}
