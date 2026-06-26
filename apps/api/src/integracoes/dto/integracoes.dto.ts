import { IsEnum, IsObject, IsOptional } from "class-validator";
import type { IntegracaoMode, IntegracaoProvider } from "@nexiforma/database";

const PROVIDERS = ["ZOOM", "TEAMS", "MOODLE"] as const;
const MODES = ["DISABLED", "OAUTH"] as const;

export class UpsertIntegracaoDto {
  @IsEnum(PROVIDERS)
  provider!: IntegracaoProvider;

  @IsEnum(MODES)
  mode!: IntegracaoMode;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
