import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class AnalisarCronogramaIaDto {
  @IsString()
  @MaxLength(250_000)
  texto!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  nomeFicheiro?: string;
}

export class PrazoModuloImportDto {
  @IsDateString()
  data!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  moduloCodigo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  moduloTitulo?: string | null;

  @IsOptional()
  @IsUUID()
  moduloUnidadeId?: string | null;
}

export class GuardarRascunhoImportIaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AplicarSessaoImportDto)
  sessoes!: AplicarSessaoImportDto[];

  @IsOptional()
  @IsDateString()
  prazoConclusaoLms?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => PrazoModuloImportDto)
  prazosModulos?: PrazoModuloImportDto[];

  @IsOptional()
  @IsString()
  @MaxLength(800)
  legendaResumo?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avisos?: string[];
}

export class AplicarSessaoImportDto {
  @IsInt()
  @Min(1)
  numeroSessao!: number;

  @IsDateString()
  data!: string;

  @Matches(/^\d{2}:\d{2}$/)
  horaInicio!: string;

  @Matches(/^\d{2}:\d{2}$/)
  horaFim!: string;

  @IsString()
  @IsIn(["presencial", "b-learning", "online", "e-learning"])
  modalidade!: string;

  @IsOptional()
  @IsUUID()
  moduloUnidadeId?: string | null;

  @IsOptional()
  @IsUUID()
  formadorId?: string | null;

  /** Nome do módulo no cronograma (exibido na UI se não houver ModuloUnidade). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tituloModulo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  moduloCodigo?: string | null;
}

export class AplicarCronogramaIaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AplicarSessaoImportDto)
  sessoes!: AplicarSessaoImportDto[];

  @IsOptional()
  @IsDateString()
  prazoConclusaoLms?: string | null;

  @IsOptional()
  @IsBoolean()
  actualizarPrazoLms?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => PrazoModuloImportDto)
  prazosModulos?: PrazoModuloImportDto[];

  /** Grava prazos LMS por módulo (datas limite de tarefas). Default: true se houver prazos. */
  @IsOptional()
  @IsBoolean()
  actualizarPrazosModulos?: boolean;

  /**
   * Activa lock manual nos módulos com prazo, para o formador ir libertando o seguinte.
   * Default: true quando se actualizam prazos por módulo.
   */
  @IsOptional()
  @IsBoolean()
  activarLockManualModulos?: boolean;

  /** Se true e já existirem sessões, falha. Se false, acrescenta com novos números. */
  @IsOptional()
  @IsBoolean()
  substituirExistentes?: boolean;

  /** Turma a que as sessões importadas ficam associadas. Default: primeira turma da acção. */
  @IsOptional()
  @IsUUID()
  turmaId?: string;
}
