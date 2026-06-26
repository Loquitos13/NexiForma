import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateSessaoFormacaoDto {
  @IsUUID()
  cronogramaId!: string;

  @IsInt()
  @Min(1)
  numeroSessao!: number;

  @IsDateString()
  data!: string;

  @Matches(/^\d{2}:\d{2}$/, { message: "horaInicio deve ser HH:mm" })
  horaInicio!: string;

  @Matches(/^\d{2}:\d{2}$/, { message: "horaFim deve ser HH:mm" })
  horaFim!: string;

  @IsString()
  @MaxLength(32)
  modalidade!: string;

  @IsOptional()
  @IsUUID()
  formadorId?: string | null;

  @IsOptional()
  @IsUUID()
  moduloUnidadeId?: string | null;
}
