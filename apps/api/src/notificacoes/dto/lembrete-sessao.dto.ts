import { IsOptional, IsUUID } from "class-validator";

export class LembreteSessaoDto {
  @IsOptional()
  @IsUUID()
  acaoId?: string;
}
