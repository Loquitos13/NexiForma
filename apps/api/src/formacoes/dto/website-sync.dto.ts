import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateWebsiteSyncDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  webhookSecret?: string;
}

export class PublicarFormacaoDto {
  @IsBoolean()
  publicado!: boolean;
}
