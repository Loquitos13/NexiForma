import { Transform, Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateIf,
} from "class-validator";

export class PropostaLinhaDto {
  @IsString()
  @Length(1, 500)
  descricao!: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value == null) return null;
    const s = String(value).trim();
    return s.length ? s : null;
  })
  @ValidateIf((_o, v) => v != null)
  @IsString()
  @Length(1, 1000)
  notas?: string | null;
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  quantidade?: number;

  @IsInt()
  @Min(0)
  precoUnitCentavos!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxaIva?: number;
}

export class PropostaLinhasDto {
  @Type(() => PropostaLinhaDto)
  linhas!: PropostaLinhaDto[];
}
