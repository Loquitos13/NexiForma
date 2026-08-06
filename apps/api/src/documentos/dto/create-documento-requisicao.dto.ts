import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateDocumentoRequisicaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titulo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  /** Pedido a um formando concreto. */
  @IsOptional()
  @IsUUID()
  formandoId?: string;

  /** Pedido a todos os formandos com matrícula activa nesta acção. */
  @IsOptional()
  @IsUUID()
  acaoFormacaoId?: string;
}
