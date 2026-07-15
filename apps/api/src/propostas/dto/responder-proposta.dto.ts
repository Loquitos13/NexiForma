import { IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class ResponderPropostaDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsIn(["aceitar", "rejeitar"])
  acao!: "aceitar" | "rejeitar";

  @IsOptional()
  @IsString()
  motivo?: string;
}
