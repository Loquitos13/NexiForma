import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { RequestUser } from "../auth/types/access-token-payload";
import { CrmService } from "./crm.service";
import { ProposalService } from "./proposal.service";
import { LeadsService } from "./leads.service";
import { TrainerManagementService } from "./trainer-management.service";
import {
  ConverterLeadDto,
  CreateLeadDto,
  CriarPropostaFromLeadDto,
  MarcarLeadPerdidoDto,
  UpdateLeadDto,
} from "./dto/leads.dto";

@Controller("crm")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly proposal: ProposalService,
    private readonly leads: LeadsService,
    private readonly trainers: TrainerManagementService,
  ) {}

  // ── Entidades ──

  @Get("entidades")
  @Roles("tenant_manager", "comercial")
  listarEntidades(
    @CurrentUser() user: RequestUser,
    @Query("nome") nome?: string,
    @Query("nif") nif?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.crm.listarEntidades(user, {
      nome,
      nif,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("entidades/:id")
  @Roles("tenant_manager", "comercial")
  obterEntidade(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ) {
    return this.crm.obterEntidade(user, id);
  }

  @Post("entidades")
  @Roles("tenant_manager", "comercial")
  criarEntidade(
    @CurrentUser() user: RequestUser,
    @Body() dto: any,
  ) {
    return this.crm.criarEntidade(user, dto);
  }

  @Put("entidades/:id")
  @Roles("tenant_manager", "comercial")
  atualizarEntidade(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: any,
  ) {
    return this.crm.atualizarEntidade(user, id, dto);
  }

  @Delete("entidades/:id")
  @Roles("tenant_manager", "comercial")
  eliminarEntidade(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ) {
    return this.crm.eliminarEntidade(user, id);
  }

  @Get("estatisticas")
  @Roles("tenant_manager", "comercial")
  obterEstatisticas(@CurrentUser() user: RequestUser) {
    return this.crm.obterEstatisticas(user);
  }

  // ── Leads ──

  @Get("leads")
  @Roles("tenant_manager", "comercial")
  listarLeads(
    @CurrentUser() user: RequestUser,
    @Query("estado") estado?: string,
    @Query("origem") origem?: string,
    @Query("q") q?: string,
  ) {
    return this.leads.list(user, { estado, origem, q });
  }

  @Get("leads/:id")
  @Roles("tenant_manager", "comercial")
  obterLead(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.leads.getOne(user, id);
  }

  @Post("leads")
  @Roles("tenant_manager", "comercial")
  criarLead(@CurrentUser() user: RequestUser, @Body() dto: CreateLeadDto) {
    return this.leads.create(user, dto);
  }

  @Put("leads/:id")
  @Roles("tenant_manager", "comercial")
  atualizarLead(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(user, id, dto);
  }

  @Post("leads/:id/perdido")
  @Roles("tenant_manager", "comercial")
  marcarLeadPerdido(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: MarcarLeadPerdidoDto,
  ) {
    return this.leads.marcarPerdido(user, id, dto);
  }

  @Post("leads/:id/converter")
  @Roles("tenant_manager", "comercial")
  converterLead(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: ConverterLeadDto,
  ) {
    return this.leads.converterEntidade(user, id, dto);
  }

  @Post("leads/:id/proposta")
  @Roles("tenant_manager", "comercial")
  propostaFromLead(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: CriarPropostaFromLeadDto,
  ) {
    return this.leads.criarProposta(user, id, dto);
  }

  // ── Propostas ──

  @Get("entidades/:entidadeId/propostas")
  @Roles("tenant_manager", "comercial")
  listarPropostas(
    @CurrentUser() user: RequestUser,
    @Param("entidadeId") entidadeId: string,
    @Query("estado") estado?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.proposal.listarPropostas(user, entidadeId, {
      estado: estado as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("propostas/:id")
  @Roles("tenant_manager", "comercial")
  obterProposta(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ) {
    return this.proposal.obterProposta(user, id);
  }

  @Post("entidades/:entidadeId/propostas")
  @Roles("tenant_manager", "comercial")
  criarProposta(
    @CurrentUser() user: RequestUser,
    @Param("entidadeId") entidadeId: string,
    @Body() dto: any,
  ) {
    dto.entidadeClienteId = entidadeId;
    return this.proposal.criarProposta(user, dto);
  }

  @Put("propostas/:id")
  @Roles("tenant_manager", "comercial")
  atualizarProposta(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: any,
  ) {
    return this.proposal.atualizarProposta(user, id, dto);
  }

  @Post("propostas/:id/enviar")
  @Roles("tenant_manager", "comercial")
  enviarProposta(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body?: any,
  ) {
    return this.proposal.enviarProposta(user, id, body?.destinatario);
  }

  @Post("propostas/:id/aceitar")
  @Roles("tenant_manager", "comercial")
  aceitarProposta(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ) {
    return this.proposal.aceitarProposta(user, id);
  }

  @Post("propostas/:id/rejeitar")
  @Roles("tenant_manager", "comercial")
  rejeitarProposta(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body?: any,
  ) {
    return this.proposal.rejeitarProposta(user, id, body?.motivo);
  }

  // ── Formadores (gestão de qualificações - só gestor) ──

  @Get("formadores")
  @Roles("tenant_manager")
  listarFormadores(
    @CurrentUser() user: RequestUser,
    @Query("nome") nome?: string,
    @Query("status") status?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.trainers.listarFormadores(user, {
      nome,
      status: status as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get("formadores/:id")
  @Roles("tenant_manager")
  obterFormador(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ) {
    return this.trainers.obterFormador(user, id);
  }

  @Put("formadores/:id/qualificacoes")
  @Roles("tenant_manager")
  atualizarQualificacoes(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() dto: any,
  ) {
    return this.trainers.atualizarQualificacoes(user, id, dto);
  }

  @Get("formadores/renovacoes")
  @Roles("tenant_manager")
  verificarRenovacoes(@CurrentUser() user: RequestUser) {
    const { requireTenantId } = require("../common/tenant-scope");
    const tenantId = requireTenantId(user);
    return this.trainers.verificarRenovacoes(tenantId);
  }
}
