import { IsDateString, IsOptional, IsString, Length } from "class-validator";

export class UpdateFormadorDto {
  @IsOptional()
  @IsString()
  @Length(1, 32)
  ccNumero?: string;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  ccpNumero?: string;

  @IsOptional()
  @IsDateString()
  ccValidade?: string;

  @IsOptional()
  @IsDateString()
  ccpValidade?: string;
}
