import { IsString, IsUUID, Length, MinLength } from "class-validator";

export class ConfirmarCmdDto {
  @IsUUID()
  processId!: string;

  @IsUUID()
  sumarioId!: string;

  @IsString()
  @MinLength(8)
  confirmToken!: string;

  @IsString()
  @Length(9, 9)
  assinanteNif!: string;

  @IsString()
  @MinLength(2)
  assinanteNome!: string;
}
