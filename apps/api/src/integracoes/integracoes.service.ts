import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IntegracaoMode, IntegracaoProvider } from "@nexiforma/database";
import type { Prisma } from "@nexiforma/database";
import { isModalidadeOnline } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import type { UpsertIntegracaoDto } from "./dto/integracoes.dto";
import { FormadorScopeService } from "../common/formador-scope.service";
import { SessoesFormacaoService } from "../sessoes-formacao/sessoes-formacao.service";

export type ReuniaoResult = {
  provider: IntegracaoProvider;
  mode: IntegracaoMode;
  meetingId: string;
  joinUrl: string;
  sessaoId: string;
  iniciadaEm?: string;
  notificacoesEnviadas?: boolean;
};

type OAuthFieldDef = { key: string; envKey: string; label: string; scope?: "tenant" | "platform" | "any" };

/** Zoom: credenciais ficam por tenant (conta Zoom do cliente). */
const ZOOM_OAUTH_FIELDS: OAuthFieldDef[] = [
  { key: "accountId", envKey: "ZOOM_ACCOUNT_ID", label: "Account ID", scope: "tenant" },
  { key: "clientId", envKey: "ZOOM_CLIENT_ID", label: "Client ID", scope: "tenant" },
  { key: "clientSecret", envKey: "ZOOM_CLIENT_SECRET", label: "Client Secret", scope: "tenant" },
  { key: "userId", envKey: "ZOOM_USER_ID", label: "Email anfitrião Zoom", scope: "tenant" },
];

/** Teams: app NexiForma (plataforma) + tenant M365 do cliente. */
const TEAMS_TENANT_FIELDS: OAuthFieldDef[] = [
  { key: "tenantId", envKey: "TEAMS_TENANT_ID", label: "Azure Tenant ID (M365 do cliente)", scope: "tenant" },
  { key: "organizerId", envKey: "TEAMS_ORGANIZER_ID", label: "Organizador M365 (email)", scope: "tenant" },
];

const TEAMS_PLATFORM_ENV = {
  clientId: ["NEXIFORMA_TEAMS_CLIENT_ID", "TEAMS_CLIENT_ID"] as const,
  clientSecret: ["NEXIFORMA_TEAMS_CLIENT_SECRET", "TEAMS_CLIENT_SECRET"] as const,
};

function providerParaModalidade(modalidade: string): "ZOOM" | "TEAMS" {
  const m = modalidade.toLowerCase();
  if (m.includes("learning") || m === "e-learning") return "TEAMS";
  if (m.includes("online")) return "ZOOM";
  return "TEAMS";
}

@Injectable()
export class IntegracoesService {
  private readonly logger = new Logger(IntegracoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly formadorScope: FormadorScopeService,
    @Inject(forwardRef(() => SessoesFormacaoService))
    private readonly sessoes: SessoesFormacaoService,
  ) {}

  /**
   * Cria reunião OAuth ao criar/activar sessão online. Sem credenciais → sessão fica sem sala (aviso na UI).
   */
  async provisionSalaAoCriarSessao(
    tenantId: string,
    sessaoId: string,
    modalidade: string,
  ): Promise<{ aviso?: string } | void> {
    if (!isModalidadeOnline(modalidade)) return;

    const provider = providerParaModalidade(modalidade);
    const readiness = await this.resolveOAuthReadiness(provider, tenantId);
    if (!readiness.ready) {
      const aviso = `Integração ${provider} não configurada para este tenant (${readiness.missing.join(", ")}).`;
      this.logger.warn(`${aviso} Sessão ${sessaoId} criada sem sala online.`);
      return { aviso };
    }

    const { config } = await this.ensureOAuthMode(tenantId, provider);
    await this.criarReuniaoOAuth(tenantId, sessaoId, provider, config, {
      iniciarENotificar: false,
    });
  }

  private async ensureOAuthMode(
    tenantId: string,
    provider: "ZOOM" | "TEAMS",
  ): Promise<{ config: Prisma.InputJsonValue }> {
    const readiness = await this.resolveOAuthReadiness(provider, tenantId);
    if (!readiness.ready) {
      throw new ServiceUnavailableException(
        `Integração ${provider} não configurada para este tenant: ${readiness.missing.join(", ")}.`,
      );
    }
    const integracao = await this.prisma.tenantIntegracao.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    const cfg = (integracao?.config ?? {}) as Record<string, string>;
    const merged = this.mergeOAuthConfig(provider, cfg);
    await this.prisma.tenantIntegracao.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        mode: "OAUTH",
        config: merged as Prisma.InputJsonValue,
      },
      update: {
        mode: "OAUTH",
        config: merged as Prisma.InputJsonValue,
      },
    });
    return { config: merged as Prisma.InputJsonValue };
  }

  async list(user: RequestUser) {
    return this.listForTenant(requireTenantId(user));
  }

  async listForTenant(tenantId: string) {
    await this.assertTenantExists(tenantId);
    const rows = await this.prisma.tenantIntegracao.findMany({ where: { tenantId } });
    const providers: IntegracaoProvider[] = ["ZOOM", "TEAMS", "MOODLE"];
    return providers.map((provider) => {
      const row = rows.find((r) => r.provider === provider);
      return {
        provider,
        mode: row?.mode ?? "DISABLED",
        configured: row?.mode === "OAUTH",
        config: this.redactConfig(row?.config),
        provisionedByPlatform: Boolean(
          row?.config && typeof row.config === "object" && (row.config as Record<string, unknown>).provisionedByPlatform,
        ),
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async oauthStatus(user: RequestUser) {
    return this.oauthStatusForTenant(requireTenantId(user));
  }

  async oauthStatusForTenant(tenantId: string) {
    await this.assertTenantExists(tenantId);
    const [zoom, teams] = await Promise.all([
      this.resolveOAuthReadiness("ZOOM", tenantId),
      this.resolveOAuthReadiness("TEAMS", tenantId),
    ]);
    return { zoom, teams, platformTeamsAppConfigured: Boolean(this.platformTeamsClientId()) };
  }

  /** Estado resumido para LMS / formadores (sem segredos). */
  async disponibilidade(user: RequestUser) {
    const tenantId = requireTenantId(user);
    const [zoomReady, teamsReady] = await Promise.all([
      this.resolveOAuthReadiness("ZOOM", tenantId),
      this.resolveOAuthReadiness("TEAMS", tenantId),
    ]);
    const avisoZoom = !zoomReady.ready
      ? `Zoom não configurado (${zoomReady.missing.join(", ")})`
      : null;
    const avisoTeams = !teamsReady.ready
      ? `Teams não configurado (${teamsReady.missing.join(", ")})`
      : null;
    return {
      zoom: {
        mode: zoomReady.mode,
        oauth: zoomReady.mode === "OAUTH",
        ready: zoomReady.ready,
        aviso: avisoZoom,
      },
      teams: {
        mode: teamsReady.mode,
        oauth: teamsReady.mode === "OAUTH",
        ready: teamsReady.ready,
        aviso: avisoTeams,
      },
      podeCriarSalaZoom: zoomReady.ready,
      podeCriarSalaTeams: teamsReady.ready,
    };
  }

  /** Passa ZOOM/TEAMS para OAUTH quando credenciais existem (.env ou config tenant). */
  async activarOAuthReal(user: RequestUser, provider: "ZOOM" | "TEAMS" | "ALL" = "ALL") {
    return this.activarOAuthRealForTenant(requireTenantId(user), provider);
  }

  async activarOAuthRealForTenant(tenantId: string, provider: "ZOOM" | "TEAMS" | "ALL" = "ALL") {
    await this.assertTenantExists(tenantId);
    const targets = provider === "ALL" ? (["ZOOM", "TEAMS"] as const) : ([provider] as const);
    const activated: ("ZOOM" | "TEAMS")[] = [];
    const skipped: { provider: "ZOOM" | "TEAMS"; reason: string }[] = [];

    for (const p of targets) {
      const readiness = await this.resolveOAuthReadiness(p, tenantId);
      if (!readiness.ready) {
        skipped.push({
          provider: p,
          reason: `Campos em falta: ${readiness.missing.join(", ")}`,
        });
        continue;
      }
      const integracao = await this.prisma.tenantIntegracao.findUnique({
        where: { tenantId_provider: { tenantId, provider: p } },
      });
      const cfg = (integracao?.config ?? {}) as Record<string, string>;
      const merged = this.mergeOAuthConfig(p, cfg);
      await this.prisma.tenantIntegracao.upsert({
        where: { tenantId_provider: { tenantId, provider: p } },
        create: {
          tenantId,
          provider: p,
          mode: "OAUTH",
          config: merged as Prisma.InputJsonValue,
        },
        update: {
          mode: "OAUTH",
          config: merged as Prisma.InputJsonValue,
        },
      });
      activated.push(p);
    }

    if (activated.length === 0) {
      throw new BadRequestException(
        skipped.map((s) => `${s.provider}: ${s.reason}`).join(" · ") ||
          "Credenciais OAuth em falta.",
      );
    }

    return {
      ok: true,
      message: `Modo OAUTH activo para ${activated.join(" e ")} – salas reais.`,
      activated,
      skipped,
    };
  }

  private mergeOAuthConfig(provider: "ZOOM" | "TEAMS", cfg: Record<string, string>) {
    if (provider === "TEAMS") {
      return {
        tenantId: cfg.tenantId ?? "",
        organizerId: cfg.organizerId ?? "",
        provisionedByPlatform: String(cfg.provisionedByPlatform) === "true",
      };
    }
    const out: Record<string, string> = { ...cfg };
    for (const f of ZOOM_OAUTH_FIELDS) {
      if (!out[f.key]) {
        const fromEnv = this.config.get<string>(f.envKey);
        if (fromEnv) out[f.key] = fromEnv;
      }
    }
    return out;
  }

  private platformTeamsClientId(): string | undefined {
    for (const key of TEAMS_PLATFORM_ENV.clientId) {
      const v = this.config.get<string>(key)?.trim();
      if (v) return v;
    }
    return undefined;
  }

  private platformTeamsClientSecret(): string | undefined {
    for (const key of TEAMS_PLATFORM_ENV.clientSecret) {
      const v = this.config.get<string>(key)?.trim();
      if (v) return v;
    }
    return undefined;
  }

  private async resolveOAuthReadiness(provider: "ZOOM" | "TEAMS", tenantId: string) {
    const integracao = await this.prisma.tenantIntegracao.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    const cfg = (integracao?.config ?? {}) as Record<string, string>;

    if (provider === "TEAMS") {
      const missing: string[] = [];
      if (!this.platformTeamsClientId()) missing.push("NEXIFORMA_TEAMS_CLIENT_ID (plataforma)");
      if (!this.platformTeamsClientSecret()) missing.push("NEXIFORMA_TEAMS_CLIENT_SECRET (plataforma)");
      for (const f of TEAMS_TENANT_FIELDS) {
        if (!cfg[f.key]?.trim()) missing.push(`${f.label} (tenant)`);
      }
      return {
        provider,
        mode: integracao?.mode ?? "DISABLED",
        ready: missing.length === 0,
        missing,
        source: "platform+tenant",
        m365TenantId: cfg.tenantId ?? null,
      };
    }

    const missing: string[] = [];
    let fromTenant = 0;
    for (const f of ZOOM_OAUTH_FIELDS) {
      if (cfg[f.key]?.trim()) fromTenant++;
      else missing.push(`${f.label} (tenant)`);
    }
    return {
      provider,
      mode: integracao?.mode ?? "DISABLED",
      ready: missing.length === 0,
      missing,
      source: fromTenant > 0 ? "tenant" : "none",
    };
  }

  private resolveOAuthCredentials(provider: "ZOOM" | "TEAMS", config: unknown) {
    const cfg = (config ?? {}) as Record<string, string>;
    if (provider === "TEAMS") {
      const clientId = this.platformTeamsClientId();
      const clientSecret = this.platformTeamsClientSecret();
      const tenantId = cfg.tenantId?.trim();
      const organizerId = cfg.organizerId?.trim();
      const missing: string[] = [];
      if (!clientId) missing.push("NEXIFORMA_TEAMS_CLIENT_ID");
      if (!clientSecret) missing.push("NEXIFORMA_TEAMS_CLIENT_SECRET");
      if (!tenantId) missing.push("tenantId");
      if (!organizerId) missing.push("organizerId");
      return {
        values: { clientId: clientId ?? "", clientSecret: clientSecret ?? "", tenantId: tenantId ?? "", organizerId: organizerId ?? "" },
        missing,
      };
    }

    const out: Record<string, string> = {};
    const missing: string[] = [];
    for (const f of ZOOM_OAUTH_FIELDS) {
      const val = cfg[f.key]?.trim() || this.config.get<string>(f.envKey)?.trim();
      if (!val) missing.push(f.envKey);
      else out[f.key] = val;
    }
    return { values: out, missing };
  }

  /** URL para o admin M365 do cliente autorizar a app NexiForma no tenant dele. */
  getMicrosoftAdminConsentUrl(m365TenantId: string) {
    const clientId = this.platformTeamsClientId();
    if (!clientId) {
      throw new BadRequestException("NEXIFORMA_TEAMS_CLIENT_ID não configurado na plataforma.");
    }
    const redirect =
      this.config.get<string>("NEXIFORMA_TEAMS_CONSENT_REDIRECT") ??
      `${this.config.get<string>("APP_PUBLIC_URL") ?? "http://localhost:3000"}/plataforma/microsoft/consent`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
    });
    return {
      url: `https://login.microsoftonline.com/${encodeURIComponent(m365TenantId)}/adminconsent?${params.toString()}`,
      redirectUri: redirect,
      clientId,
    };
  }

  async upsertForTenant(
    tenantId: string,
    dto: UpsertIntegracaoDto,
    opts?: { provisionedByPlatform?: boolean },
  ): Promise<import("@nexiforma/database").TenantIntegracao> {
    await this.assertTenantExists(tenantId);
    const existing = await this.prisma.tenantIntegracao.findUnique({
      where: { tenantId_provider: { tenantId, provider: dto.provider } },
    });
    const prevCfg =
      existing?.config && typeof existing.config === "object"
        ? (existing.config as Record<string, unknown>)
        : {};
    const config = { ...prevCfg, ...(dto.config ?? {}) } as Record<string, unknown>;
    if (opts?.provisionedByPlatform) {
      config.provisionedByPlatform = true;
    }
    if (dto.provider === "TEAMS") {
      delete config.clientId;
      delete config.clientSecret;
    }
    if (
      dto.mode === "OAUTH" &&
      (dto.provider === "ZOOM" || dto.provider === "TEAMS")
    ) {
      const readiness = await this.resolveOAuthReadiness(dto.provider, tenantId);
      if (!readiness.ready) {
        throw new BadRequestException(
          `Credenciais OAuth em falta: ${readiness.missing.join(", ")}`,
        );
      }
    }
    return this.prisma.tenantIntegracao.upsert({
      where: { tenantId_provider: { tenantId, provider: dto.provider } },
      create: {
        tenantId,
        provider: dto.provider,
        mode: dto.mode,
        config: config as Prisma.InputJsonValue,
      },
      update: {
        mode: dto.mode,
        config: config as Prisma.InputJsonValue,
      },
    });
  }

  private async assertTenantExists(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!t) throw new NotFoundException("Tenant não encontrado.");
  }

  private async readUpstreamError(res: Response, label: string): Promise<string> {
    const body = await res.text().catch(() => "");
    const snippet = body.slice(0, 280).replace(/\s+/g, " ").trim();
    return snippet ? `${label} (${res.status}): ${snippet}` : `${label} (HTTP ${res.status})`;
  }

  async upsert(user: RequestUser, dto: UpsertIntegracaoDto): Promise<import("@nexiforma/database").TenantIntegracao> {
    const tenantId = requireTenantId(user);
    const existing = await this.prisma.tenantIntegracao.findUnique({
      where: { tenantId_provider: { tenantId, provider: dto.provider } },
    });
    const cfg = existing?.config as Record<string, unknown> | undefined;
    if (cfg?.provisionedByPlatform && dto.provider !== "MOODLE") {
      throw new BadRequestException(
        "Integração Zoom/Teams gerida pela NexiForma – contacte o suporte ou use a plataforma.",
      );
    }
    return this.upsertForTenant(tenantId, dto);
  }

  async testarConexaoForTenant(tenantId: string, provider: "ZOOM" | "TEAMS") {
    await this.assertTenantExists(tenantId);
    const integracao = await this.prisma.tenantIntegracao.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    const mode = integracao?.mode ?? "DISABLED";
    if (mode !== "OAUTH") {
      throw new ServiceUnavailableException(
        `Integração ${provider} desactivada - activa OAuth em Integrações.`,
      );
    }
    return this.testarConexaoOAuth(integracao?.config, provider);
  }

  async criarReuniao(
    user: RequestUser,
    sessaoId: string,
    provider: "ZOOM" | "TEAMS",
  ): Promise<ReuniaoResult> {
    const tenantId = requireTenantId(user);
    const sessao = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
    });
    if (!sessao) {
      throw new NotFoundException("Sessão não encontrada.");
    }

    if (user.role !== "formador") {
      throw new ForbiddenException(
        "Apenas o formador pode criar a sala e iniciar a sessão (notificação aos formandos).",
      );
    }

    if (user.role === "formador") {
      const profileId = await this.formadorScope.getProfileId(user);
      if (!profileId || sessao.formadorId !== profileId) {
        throw new ForbiddenException("Só podes criar salas para sessões que te estão atribuídas.");
      }
    }

    const readiness = await this.resolveOAuthReadiness(provider, tenantId);
    if (!readiness.ready) {
      throw new ServiceUnavailableException(
        `Integração ${provider} não configurada - ${readiness.missing.join(", ")}.`,
      );
    }

    const { config } = await this.ensureOAuthMode(tenantId, provider);
    return this.criarReuniaoOAuth(tenantId, sessaoId, provider, config, {
      iniciarENotificar: true,
    });
  }

  async testarConexao(user: RequestUser, provider: "ZOOM" | "TEAMS") {
    const tenantId = requireTenantId(user);
    const integracao = await this.prisma.tenantIntegracao.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    const mode = integracao?.mode ?? "DISABLED";
    if (mode !== "OAUTH") {
      throw new ServiceUnavailableException(
        `Integração ${provider} desactivada - activa OAuth em Integrações.`,
      );
    }
    return this.testarConexaoOAuth(integracao?.config, provider);
  }

  private async testarConexaoOAuth(config: unknown, provider: "ZOOM" | "TEAMS") {
    const mode = "OAUTH" as const;
    if (provider === "ZOOM") {
      const { values, missing } = this.resolveOAuthCredentials("ZOOM", config);
      if (missing.length) {
        throw new BadRequestException(`Credenciais Zoom em falta: ${missing.join(", ")}`);
      }
      await this.fetchZoomToken(values.accountId, values.clientId, values.clientSecret);
      return {
        ok: true,
        provider,
        mode,
        message: "Credenciais Zoom válidas – podes criar reuniões reais.",
      };
    }

    const { values, missing } = this.resolveOAuthCredentials("TEAMS", config);
    if (missing.length) {
      throw new BadRequestException(`Credenciais Teams em falta: ${missing.join(", ")}`);
    }
    const token = await this.fetchMsToken(values.tenantId, values.clientId, values.clientSecret);
    const organizer = await this.resolveMsUser(token, values.organizerId);
    const probe = await fetch(
      `https://graph.microsoft.com/v1.0/users/${organizer.id}?$select=id,displayName,mail`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!probe.ok) {
      throw new BadRequestException(
        await this.readUpstreamError(
          probe,
          "Token Microsoft OK, mas organizador inacessível – verifica TEAMS_ORGANIZER_ID e permissão User.Read.All",
        ),
      );
    }
    return {
      ok: true,
      provider,
      mode,
      message:
        `Organizador OK (${organizer.displayName ?? organizer.mail ?? organizer.id}). ` +
        `Object ID: ${organizer.id}. Se criar reunião der 404, configura CsApplicationAccessPolicy no Teams PowerShell.`,
    };
  }

  async moodleSync(user: RequestUser, cursoId?: string) {
    const tenantId = requireTenantId(user);
    const integracao = await this.prisma.tenantIntegracao.findUnique({
      where: { tenantId_provider: { tenantId, provider: "MOODLE" } },
    });
    const mode = integracao?.mode ?? "DISABLED";
    if (mode === "DISABLED") {
      throw new ServiceUnavailableException("Integração Moodle não activa.");
    }

    const cfg = (integracao?.config ?? {}) as { baseUrl?: string; token?: string };
    const baseUrl = cfg.baseUrl ?? this.config.get<string>("MOODLE_BASE_URL");
    const token = cfg.token ?? this.config.get<string>("MOODLE_WS_TOKEN");
    if (!baseUrl || !token) {
      throw new BadRequestException("MOODLE baseUrl/token em falta na integração.");
    }

    const url = `${baseUrl.replace(/\/$/, "")}/webservice/rest/server.php?wstoken=${encodeURIComponent(token)}&wsfunction=core_course_get_courses&moodlewsrestformat=json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(`Moodle respondeu ${res.status}.`);
    }
    const cursos = (await res.json()) as unknown[];
    return { mode, cursos, cursoId: cursoId ?? null };
  }

  private async criarReuniaoOAuth(
    tenantId: string,
    sessaoId: string,
    provider: "ZOOM" | "TEAMS",
    config: unknown,
    options?: { iniciarENotificar?: boolean },
  ): Promise<ReuniaoResult> {
    const iniciarENotificar = options?.iniciarENotificar !== false;
    if (provider === "ZOOM") {
      const { values, missing } = this.resolveOAuthCredentials("ZOOM", config);
      if (missing.length) {
        throw new BadRequestException(`Credenciais Zoom em falta: ${missing.join(", ")}`);
      }
      const token = await this.fetchZoomToken(values.accountId, values.clientId, values.clientSecret);
      const meeting = await this.createZoomMeeting(token, values.userId);
      await this.prisma.sessaoFormacao.update({
        where: { id: sessaoId },
        data: {
          lmsAtivo: true,
          zoomMeetingId: String(meeting.id),
          teamsMeetingId: null,
          salaJoinUrl: meeting.join_url,
        },
      });
      let notificacoesEnviadas = false;
      let iniciadaEm: Date | null = null;
      if (iniciarENotificar) {
        const inicio = await this.sessoes.iniciarAoCriarReuniao(tenantId, sessaoId);
        notificacoesEnviadas = inicio.notificacoesEnviadas;
        iniciadaEm = inicio.iniciadaEm;
      } else {
        const sessao = await this.prisma.sessaoFormacao.findFirst({
          where: { id: sessaoId, tenantId },
          select: { iniciadaEm: true },
        });
        iniciadaEm = sessao?.iniciadaEm ?? null;
      }
      return {
        provider,
        mode: "OAUTH",
        meetingId: String(meeting.id),
        joinUrl: meeting.join_url,
        sessaoId,
        iniciadaEm: iniciadaEm?.toISOString(),
        notificacoesEnviadas,
      };
    }

    const { values, missing } = this.resolveOAuthCredentials("TEAMS", config);
    if (missing.length) {
      throw new BadRequestException(`Credenciais Teams em falta: ${missing.join(", ")}`);
    }
    const token = await this.fetchMsToken(values.tenantId, values.clientId, values.clientSecret);
    const meeting = await this.createTeamsMeeting(token, values.organizerId);
    await this.prisma.sessaoFormacao.update({
      where: { id: sessaoId },
      data: {
        lmsAtivo: true,
        teamsMeetingId: meeting.id,
        zoomMeetingId: null,
        salaJoinUrl: meeting.joinUrl,
      },
    });
    let notificacoesEnviadas = false;
    let iniciadaEm: Date | null = null;
    if (iniciarENotificar) {
      const inicio = await this.sessoes.iniciarAoCriarReuniao(tenantId, sessaoId);
      notificacoesEnviadas = inicio.notificacoesEnviadas;
      iniciadaEm = inicio.iniciadaEm;
    } else {
      const sessao = await this.prisma.sessaoFormacao.findFirst({
        where: { id: sessaoId, tenantId },
        select: { iniciadaEm: true },
      });
      iniciadaEm = sessao?.iniciadaEm ?? null;
    }
    return {
      provider: "TEAMS",
      mode: "OAUTH",
      meetingId: meeting.id,
      joinUrl: meeting.joinUrl,
      sessaoId,
      iniciadaEm: iniciadaEm?.toISOString(),
      notificacoesEnviadas,
    };
  }

  private async fetchZoomToken(accountId: string, clientId: string, clientSecret: string) {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
      method: "POST",
      headers: { authorization: `Basic ${basic}` },
    });
    if (!res.ok) {
      throw new BadRequestException(await this.readUpstreamError(res, "Falha OAuth Zoom"));
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  private async createZoomMeeting(token: string, userId: string) {
    const res = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/meetings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        topic: "Sessão NexiForma",
        type: 2,
        settings: { join_before_host: true },
      }),
    });
    if (!res.ok) {
      throw new BadRequestException(await this.readUpstreamError(res, "Falha ao criar reunião Zoom"));
    }
    return (await res.json()) as { id: number; join_url: string };
  }

  private async fetchMsToken(tenantId: string, clientId: string, clientSecret: string) {
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );
    if (!res.ok) {
      throw new BadRequestException(await this.readUpstreamError(res, "Falha OAuth Microsoft"));
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  private async resolveMsUser(
    token: string,
    idOrUpn: string,
  ): Promise<{ id: string; displayName?: string; mail?: string; userPrincipalName?: string }> {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(idOrUpn)}?$select=id,displayName,mail,userPrincipalName`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new BadRequestException(
        await this.readUpstreamError(
          res,
          `Organizador «${idOrUpn}» não encontrado no tenant M365 – usa email ou Object ID válido`,
        ),
      );
    }
    return (await res.json()) as { id: string; displayName?: string; mail?: string; userPrincipalName?: string };
  }

  private teamsMeetingErrorHint(status: number): string {
    if (status === 404 || status === 403) {
      return (
        " Para app-only (NexiForma), o admin M365 deve executar no Teams PowerShell: " +
        "New-CsApplicationAccessPolicy -Identity NexiForma -AppIds «CLIENT_ID»; " +
        "Grant-CsApplicationAccessPolicy -PolicyName NexiForma -Identity «OBJECT_ID_ORGANIZADOR». " +
        "Aguarda até 30 min. O organizador precisa licença Teams."
      );
    }
    return "";
  }

  private async createTeamsMeeting(token: string, organizerIdOrEmail: string) {
    const organizer = await this.resolveMsUser(token, organizerIdOrEmail);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${organizer.id}/onlineMeetings`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject: "Sessão NexiForma",
          startDateTime: new Date().toISOString(),
          endDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        }),
      },
    );
    if (!res.ok) {
      const base = await this.readUpstreamError(res, "Falha ao criar reunião Teams");
      throw new BadRequestException(`${base}${this.teamsMeetingErrorHint(res.status)}`);
    }
    const data = (await res.json()) as { id: string; joinWebUrl: string };
    if (!data.joinWebUrl) {
      throw new BadRequestException("Graph não devolveu joinWebUrl – verifica permissões OnlineMeetings.ReadWrite.All.");
    }
    return { id: data.id, joinUrl: data.joinWebUrl, organizerObjectId: organizer.id };
  }

  private redactConfig(config: unknown) {
    if (!config || typeof config !== "object") return null;
    const c = { ...(config as Record<string, unknown>) };
    for (const key of ["token", "clientSecret", "apiKey", "password"]) {
      if (key in c) c[key] = "***";
    }
    return c;
  }
}
