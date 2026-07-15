import { IsOptional, IsString, Matches } from "class-validator";

/** Intervalo de datas para pedidos QUERY (calendário, relatórios, etc.). */
export class DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  inicio?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fim?: string;
}
