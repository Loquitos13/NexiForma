import { All, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { HttpQueryMethodGuard } from "../common/http-query.guard";
import { TokenQueryDto } from "../common/dto/token-query.dto";
import { ProposalService } from "../crm/proposal.service";
import { ResponderPropostaDto } from "./dto/responder-proposta.dto";

/** Resposta do cliente à proposta comercial (sem autenticação). */
@Public()
@Controller("propostas/resposta")
export class PropostaRespostaController {
  constructor(private readonly proposal: ProposalService) {}

  /** @deprecated Preferir QUERY /preview - evita token em logs de URL. */
  @Get()
  previewLegacy(@Query("token") token: string) {
    if (!token?.trim()) {
      return { erro: "Link inválido." };
    }
    return this.proposal.previewRespostaProposta(token.trim());
  }

  @UseGuards(HttpQueryMethodGuard)
  @All("preview")
  previewQuery(@Body() dto: TokenQueryDto) {
    return this.proposal.previewRespostaProposta(dto.token.trim());
  }

  @Post()
  responder(@Body() dto: ResponderPropostaDto) {
    return this.proposal.responderPropostaPorToken(
      dto.token.trim(),
      dto.acao,
      dto.motivo?.trim() || undefined,
    );
  }
}
