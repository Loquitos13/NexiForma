import { IsBoolean, IsOptional } from "class-validator";

export class TerminarSessaoDto {
  /**
   * Quando a sessão tem folha e/ou sumário por validar, o fecho exige
   * `confirmarPendencias: true` (após o formador confirmar no UI).
   */
  @IsOptional()
  @IsBoolean()
  confirmarPendencias?: boolean;
}
