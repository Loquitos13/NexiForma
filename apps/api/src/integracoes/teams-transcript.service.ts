import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseVttToPlainText, type TeamsTranscricaoEstado } from "@nexiforma/shared";
import { PrismaService } from "../prisma/prisma.service";
import { IntegracoesService } from "./integracoes.service";
import { ExternalServiceEventService } from "../common/external-service-event.service";

type FetchResult =
  | { ok: true; text: string }
  | { ok: false; retryable: boolean; message: string };

export type TeamsTranscricaoImportResult = {
  estado: TeamsTranscricaoEstado;
  mensagem?: string;
  teamsTranscricao?: string | null;
};

@Injectable()
export class TeamsTranscriptService {
  private readonly logger = new Logger(TeamsTranscriptService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => IntegracoesService))
    private readonly integracoes: IntegracoesService,
    private readonly config: ConfigService,
    private readonly externalEvents: ExternalServiceEventService,
  ) {}

  /** Marca reunião CRM para importação de transcrição após fecho. */
  async marcarPendenteCrm(interaccaoId: string, tenantId: string): Promise<void> {
    await this.prisma.interaccaoComercial.updateMany({
      where: { id: interaccaoId, tenantId, teamsMeetingId: { not: null } },
      data: { teamsTranscricaoEstado: "PENDENTE" },
    });
  }

  /** Marca sessão formativa para importação de transcrição após fecho. */
  async marcarPendenteSessao(sessaoId: string, tenantId: string): Promise<void> {
    await this.prisma.sessaoFormacao.updateMany({
      where: { id: sessaoId, tenantId, teamsMeetingId: { not: null } },
      data: { teamsTranscricaoEstado: "PENDENTE" },
    });
  }

  /** Importação imediata (CRM) - útil após terminar reunião ou botão manual. */
  async importarCrm(interaccaoId: string, tenantId: string): Promise<TeamsTranscricaoImportResult> {
    const row = await this.prisma.interaccaoComercial.findFirst({
      where: { id: interaccaoId, tenantId, tipo: "REUNIAO" },
      select: { teamsMeetingId: true, teamsTranscricaoEstado: true },
    });
    if (!row?.teamsMeetingId) {
      return {
        estado: "INDISPONIVEL",
        mensagem: "Reunião sem identificador Teams - não há transcrição para importar.",
      };
    }
    return this.persistCrm(interaccaoId, tenantId, row.teamsMeetingId);
  }

  /** Importação imediata (sessão formação). */
  async importarSessao(sessaoId: string, tenantId: string): Promise<TeamsTranscricaoImportResult> {
    const row = await this.prisma.sessaoFormacao.findFirst({
      where: { id: sessaoId, tenantId },
      select: { teamsMeetingId: true },
    });
    if (!row?.teamsMeetingId) {
      return {
        estado: "INDISPONIVEL",
        mensagem: "Sessão sem sala Teams - não há transcrição para importar.",
      };
    }
    return this.persistSessao(sessaoId, tenantId, row.teamsMeetingId);
  }

  /** Cron: tenta importar transcrições pendentes (CRM + sessões). */
  async processarPendentes(limit = 20): Promise<number> {
    const enabled = this.config.get<string>("CRON_TEAMS_TRANSCRICAO_ENABLED");
    const fallback = this.config.get<string>("CRON_NOTIFICACOES_ENABLED") === "true";
    if (enabled !== "true" && !fallback) return 0;

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    let done = 0;

    const reunioes = await this.prisma.interaccaoComercial.findMany({
      where: {
        tipo: "REUNIAO",
        teamsTranscricaoEstado: "PENDENTE",
        teamsMeetingId: { not: null },
        reuniaoTerminadaEm: { gte: cutoff },
      },
      select: { id: true, tenantId: true, teamsMeetingId: true },
      take: limit,
      orderBy: { reuniaoTerminadaEm: "asc" },
    });

    for (const r of reunioes) {
      if (!r.teamsMeetingId) continue;
      const { estado } = await this.persistCrm(r.id, r.tenantId, r.teamsMeetingId);
      if (estado !== "PENDENTE") done += 1;
    }

    const restante = Math.max(0, limit - reunioes.length);
    if (restante > 0) {
      const sessoes = await this.prisma.sessaoFormacao.findMany({
        where: {
          teamsTranscricaoEstado: "PENDENTE",
          teamsMeetingId: { not: null },
          terminadaEm: { gte: cutoff },
        },
        select: { id: true, tenantId: true, teamsMeetingId: true },
        take: restante,
        orderBy: { terminadaEm: "asc" },
      });
      for (const s of sessoes) {
        if (!s.teamsMeetingId) continue;
        const { estado } = await this.persistSessao(s.id, s.tenantId, s.teamsMeetingId);
        if (estado !== "PENDENTE") done += 1;
      }
    }

    return done;
  }

  private async persistCrm(
    interaccaoId: string,
    tenantId: string,
    meetingId: string,
  ): Promise<TeamsTranscricaoImportResult> {
    const result = await this.fetchFromGraph(tenantId, meetingId);
    const estado = this.estadoFromResult(result);
    if (result.ok) {
      await this.prisma.interaccaoComercial.update({
        where: { id: interaccaoId },
        data: {
          teamsTranscricao: result.text,
          teamsTranscricaoEstado: "DISPONIVEL",
        },
      });
      await this.anexarTranscricaoNotaFollowUp(interaccaoId, tenantId, result.text);
      this.externalEvents.recordSuccess({
        service: "teams",
        tenantId,
        message: "Transcrição Teams importada (CRM).",
        resourceRef: meetingId,
        code: "TRANSCRIPT_IMPORTED",
      });
      return { estado, teamsTranscricao: result.text };
    }

    const mensagem = this.mensagemParaUtilizador(result, estado);
    await this.prisma.interaccaoComercial.update({
      where: { id: interaccaoId },
      data: { teamsTranscricaoEstado: estado },
    });
    if (estado === "ERRO") {
      this.logger.warn(
        `Transcrição CRM ${interaccaoId} tenant=${tenantId}: ${result.message}`,
      );
      this.externalEvents.recordError({
        service: "teams",
        tenantId,
        message: result.message,
        resourceRef: meetingId,
        code: "TRANSCRIPT_ERROR",
      });
    }
    return { estado, mensagem };
  }

  private async persistSessao(
    sessaoId: string,
    tenantId: string,
    meetingId: string,
  ): Promise<TeamsTranscricaoImportResult> {
    const result = await this.fetchFromGraph(tenantId, meetingId);
    const estado = this.estadoFromResult(result);
    if (result.ok) {
      await this.prisma.sessaoFormacao.update({
        where: { id: sessaoId },
        data: {
          teamsTranscricao: result.text,
          teamsTranscricaoEstado: "DISPONIVEL",
        },
      });
      await this.anexarTranscricaoSumario(sessaoId, tenantId, result.text);
      this.externalEvents.recordSuccess({
        service: "teams",
        tenantId,
        message: "Transcrição Teams importada (sessão).",
        resourceRef: meetingId,
        code: "TRANSCRIPT_IMPORTED",
      });
      return { estado, teamsTranscricao: result.text };
    }

    const mensagem = this.mensagemParaUtilizador(result, estado);
    await this.prisma.sessaoFormacao.update({
      where: { id: sessaoId },
      data: { teamsTranscricaoEstado: estado },
    });
    if (estado === "ERRO") {
      this.logger.warn(
        `Transcrição sessão ${sessaoId} tenant=${tenantId}: ${result.message}`,
      );
      this.externalEvents.recordError({
        service: "teams",
        tenantId,
        message: result.message,
        resourceRef: meetingId,
        code: "TRANSCRIPT_ERROR",
      });
    }
    return { estado, mensagem };
  }

  private mensagemParaUtilizador(
    result: Extract<FetchResult, { ok: false }>,
    estado: TeamsTranscricaoEstado,
  ): string {
    const graphCode = this.extractGraphErrorCode(result.message);
    if (graphCode === "GraphAccessToTranscriptsDisabled") {
      return (
        "O tenant Teams ainda não permite acesso Graph às transcrições. " +
        "No Teams Admin Center: Meetings → Meeting settings → Microsoft Graph access = On. " +
        "Aguarda 15–30 min após activar e testa numa reunião nova com transcrição iniciada."
      );
    }
    if (result.message.includes("403")) {
      if (graphCode === "Forbidden" || graphCode === "AccessDenied") {
        return (
          "Sem permissão Microsoft Graph para ler transcrições (HTTP 403). " +
          "Confirma admin consent em OnlineMeetingTranscript.Read.All, a Application Access Policy " +
          "(App ID a2df54bf… + organizador M365) e que a transcrição foi iniciada na reunião."
        );
      }
      return (
        "Sem permissão Microsoft Graph para ler transcrições (HTTP 403). " +
        "Confirma admin consent em OnlineMeetingTranscript.Read.All e a Application Access Policy " +
        "no PowerShell (App ID + organizador M365)."
      );
    }
    if (estado === "PENDENTE") {
      return (
        "Transcrição ainda não disponível no Teams - aguarda alguns minutos após terminar a reunião " +
        "e confirma que a transcrição foi iniciada na chamada."
      );
    }
    if (estado === "INDISPONIVEL") {
      return (
        "Transcrição indisponível - inicia a transcrição manualmente na reunião Teams " +
        "ou activa a política de transcrição automática no Teams Admin."
      );
    }
    return result.message.slice(0, 280);
  }

  private estadoFromResult(result: FetchResult): TeamsTranscricaoEstado {
    if (result.ok) return "DISPONIVEL";
    if (result.retryable) return "PENDENTE";
    if (result.message.includes("403")) {
      const code = this.extractGraphErrorCode(result.message);
      if (code === "GraphAccessToTranscriptsDisabled") return "PENDENTE";
      return "ERRO";
    }
    return "INDISPONIVEL";
  }

  private extractGraphErrorCode(message: string): string | null {
    const match =
      message.match(/"code"\s*:\s*"([^"]+)"/) ??
      message.match(/innerError[^}]*"code"\s*:\s*"([^"]+)"/);
    return match?.[1] ?? null;
  }

  private async fetchFromGraph(tenantId: string, meetingId: string): Promise<FetchResult> {
    try {
      const ctx = await this.integracoes.getTeamsGraphAccess(tenantId);
      const userId = encodeURIComponent(ctx.organizerObjectId);
      const meetingEnc = encodeURIComponent(meetingId);
      const listUrl = `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingEnc}/transcripts`;

      const listRes = await fetch(listUrl, {
        headers: { authorization: `Bearer ${ctx.token}` },
      });
      if (listRes.status === 404) {
        return { ok: false, retryable: true, message: "Transcrição ainda não disponível (404)." };
      }
      if (!listRes.ok) {
        const detail = await listRes.text();
        const retryable = listRes.status === 429 || listRes.status >= 500;
        return {
          ok: false,
          retryable,
          message: `Graph transcripts HTTP ${listRes.status}: ${detail.slice(0, 400)}`,
        };
      }

      const listJson = (await listRes.json()) as { value?: Array<{ id?: string }> };
      const transcriptId = listJson.value?.[0]?.id;
      if (!transcriptId) {
        return { ok: false, retryable: true, message: "Sem transcrições listadas." };
      }

      const contentUrl = `https://graph.microsoft.com/v1.0/users/${userId}/onlineMeetings/${meetingEnc}/transcripts/${encodeURIComponent(transcriptId)}/content`;
      const contentRes = await fetch(contentUrl, {
        headers: {
          authorization: `Bearer ${ctx.token}`,
          accept: "text/vtt",
        },
      });
      if (contentRes.status === 404) {
        return { ok: false, retryable: true, message: "Conteúdo VTT ainda não disponível." };
      }
      if (!contentRes.ok) {
        const detail = await contentRes.text();
        return {
          ok: false,
          retryable: contentRes.status >= 500,
          message: `Graph transcript content HTTP ${contentRes.status}: ${detail.slice(0, 400)}`,
        };
      }

      const vtt = await contentRes.text();
      const text = parseVttToPlainText(vtt);
      if (!text) {
        return { ok: false, retryable: true, message: "VTT vazio ou ilegível." };
      }
      return { ok: true, text };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`fetchFromGraph tenant=${tenantId}: ${message}`);
      return { ok: false, retryable: true, message };
    }
  }

  /** Anexa transcrição à nota follow-up mais recente da reunião. */
  private async anexarTranscricaoNotaFollowUp(
    reuniaoId: string,
    tenantId: string,
    transcricao: string,
  ): Promise<void> {
    const nota = await this.prisma.interaccaoComercial.findFirst({
      where: { tenantId, reuniaoOrigemId: reuniaoId, tipo: "NOTA" },
      orderBy: { createdAt: "desc" },
      select: { id: true, notasLivres: true },
    });
    if (!nota) return;

    const bloco = `--- Transcrição Teams ---\n${transcricao}`;
    const merged = nota.notasLivres?.includes("--- Transcrição Teams ---")
      ? nota.notasLivres
      : [nota.notasLivres?.trim(), bloco].filter(Boolean).join("\n\n");

    await this.prisma.interaccaoComercial.update({
      where: { id: nota.id },
      data: {
        notasLivres: merged,
        processamentoEstado: "PENDENTE",
      },
    });
  }

  /** Preenche sumário interno com transcrição se ainda não existir conteúdo. */
  private async anexarTranscricaoSumario(
    sessaoId: string,
    tenantId: string,
    transcricao: string,
  ): Promise<void> {
    const existing = await this.prisma.sumario.findFirst({
      where: { sessaoId, tenantId },
      select: { id: true, conteudo: true, imutavel: true },
    });
    const bloco = `Transcrição Teams (automática):\n\n${transcricao}`;
    if (existing?.imutavel) return;

    if (existing) {
      if (existing.conteudo.includes("Transcrição Teams (automática)")) return;
      const merged = existing.conteudo.trim()
        ? `${existing.conteudo.trim()}\n\n${bloco}`
        : bloco;
      await this.prisma.sumario.update({
        where: { id: existing.id },
        data: { conteudo: merged },
      });
      return;
    }

    await this.prisma.sumario.create({
      data: {
        tenantId,
        sessaoId,
        conteudo: bloco,
      },
    });
  }
}
