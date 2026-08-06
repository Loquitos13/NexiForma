import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { HttpQueryMethodGuard } from "../common/http-query.guard";
import { DateRangeQueryDto } from "../common/dto/date-range-query.dto";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CalendarioService } from "./calendario.service";
import { CalendarioNotasService } from "./calendario-notas.service";
import {
  CreateCalendarioNotaDto,
  UpdateCalendarioNotaDto,
} from "./dto/calendario-nota.dto";
import type { CalendarioNotaResposta } from "./calendario-notas.service";

@Controller("calendario")
@UseGuards(JwtAuthGuard)
export class CalendarioController {
  constructor(
    private readonly calendario: CalendarioService,
    private readonly notas: CalendarioNotasService,
  ) {}

  private resolveRange(inicio?: string, fim?: string) {
    const now = new Date();
    const start = inicio || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end =
      fim || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  }

  /** Preferir QUERY /eventos - intervalo no corpo, não na URL. */
  @UseGuards(HttpQueryMethodGuard)
  @All("eventos")
  listEventosQuery(
    @CurrentUser() user: RequestUser,
    @Body() dto: DateRangeQueryDto,
  ) {
    const { start, end } = this.resolveRange(dto.inicio, dto.fim);
    return this.calendario.listEventos(user, start, end);
  }

  /** @deprecated Use QUERY /calendario/eventos */
  @Get("eventos")
  listEventosLegacy(
    @CurrentUser() user: RequestUser,
    @Query("inicio") inicio: string,
    @Query("fim") fim: string,
  ) {
    const { start, end } = this.resolveRange(inicio, fim);
    return this.calendario.listEventos(user, start, end);
  }

  @Post("notas")
  createNota(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCalendarioNotaDto,
  ): Promise<CalendarioNotaResposta> {
    return this.notas.create(user, dto);
  }

  @Patch("notas/:id")
  updateNota(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarioNotaDto,
  ): Promise<CalendarioNotaResposta> {
    return this.notas.update(user, id, dto);
  }

  @Delete("notas/:id")
  removeNota(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.notas.remove(user, id);
  }
}
