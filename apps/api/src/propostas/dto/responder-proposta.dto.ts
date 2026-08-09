import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ResponderPropostaDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsIn(["aceitar", "rejeitar"])
  acao!: "aceitar" | "rejeitar";

  /** Nota do cliente ao rejeitar - guardada na proposta e visível à equipa comercial. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivo?: string;
}
