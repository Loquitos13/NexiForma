import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { QuizPergunta, QuizTentativa } from "@nexiforma/database";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { QuizzesService, type QuizSubmitResult } from "./quizzes.service";
import { CreateQuizPerguntaDto, SubmitQuizDto, UpdateQuizPerguntaDto } from "./dto/quizzes.dto";

@Controller("quizzes")
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get("modulos/:moduloId/perguntas")
  @Roles("tenant_manager", "formador", "formando")
  perguntas(
    @CurrentUser() user: RequestUser,
    @Param("moduloId", ParseUUIDPipe) moduloId: string,
  ): Promise<QuizPergunta[] | Array<{ id: string; enunciado: string; ordem: number; pontos: number; opcoes: Array<{ id: string; texto: string }> }>> {
    if (user.role === "formando") {
      return this.quizzes.listPerguntasFormando(user, moduloId);
    }
    return this.quizzes.listPerguntas(user, moduloId);
  }

  @Post("perguntas")
  @Roles("tenant_manager", "formador")
  createPergunta(@CurrentUser() user: RequestUser, @Body() dto: CreateQuizPerguntaDto): Promise<QuizPergunta> {
    return this.quizzes.createPergunta(user, dto);
  }

  @Patch("perguntas/:id")
  @Roles("tenant_manager", "formador")
  updatePergunta(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizPerguntaDto,
  ): Promise<QuizPergunta> {
    return this.quizzes.updatePergunta(user, id, dto);
  }

  @Delete("perguntas/:id")
  @Roles("tenant_manager", "formador")
  deletePergunta(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.quizzes.deletePergunta(user, id);
  }

  @Post("modulos/:moduloId/submeter")
  @Roles("formando", "tenant_manager", "formador")
  submit(
    @CurrentUser() user: RequestUser,
    @Param("moduloId", ParseUUIDPipe) moduloId: string,
    @Query("matriculaId") matriculaId: string,
    @Body() dto: SubmitQuizDto,
  ): Promise<QuizSubmitResult> {
    return this.quizzes.submitTentativa(user, matriculaId, moduloId, dto);
  }

  @Get("tentativas")
  @Roles("tenant_manager", "formador", "formando")
  tentativas(
    @CurrentUser() user: RequestUser,
    @Query("matriculaId") matriculaId: string,
    @Query("moduloId") moduloId?: string,
  ): Promise<QuizTentativa[]> {
    return this.quizzes.listTentativas(user, matriculaId, moduloId);
  }
}
