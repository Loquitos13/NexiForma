import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** Corpo QUERY para operações que antes usavam query string com tokens. */
export class TokenQueryDto {
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  token!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  acao?: string;
}
