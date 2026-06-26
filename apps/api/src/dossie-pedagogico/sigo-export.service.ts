import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestUser } from "../auth/types/access-token-payload";
import { requireTenantId } from "../common/tenant-scope";
import { DossiePedagogicoService } from "./dossie-pedagogico.service";
import { validateSigoPayload } from "./sigo-validation.util";

/** Pacote de preparação para importação manual na plataforma SIGO (DGEEC) – não é API oficial. */
export const SIGO_EXPORT_SCHEMA = "nexiforma.sigo_export.v1";

const SIGO_AVISO =
  "Pacote NexiForma para apoio ao registo/importação na plataforma SIGO. " +
  "Não substitui credenciais nem submissão oficial junto da DGEEC/DGERT.";

function safeExportSlug(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_|_$/g, "").slice(0, 64) || "acao";
}

function isoDateOnly(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type PresencaAgg = { total: number; presentes: number; validadas: number };

@Injectable()
export class SigoExportService {
  constructor(
    private readonly dossie: DossiePedagogicoService,
    private readonly prisma: PrismaService,
  ) {}

  async buildSigoJsonPackage(user: RequestUser, acaoId: string) {
    const tenantId = requireTenantId(user);
    const dossie = await this.dossie.getByAcaoFormacao(user, acaoId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, legalName: true, nif: true, status: true },
    });
    if (!tenant) {
      throw new NotFoundException("Tenant não encontrado.");
    }

    const presencas = await this.prisma.presenca.findMany({
      where: {
        tenantId,
        matricula: { turma: { acaoFormacaoId: acaoId } },
      },
      select: { matriculaId: true, presente: true, validado: true },
    });

    const presByMat = new Map<string, PresencaAgg>();
    for (const p of presencas) {
      const cur = presByMat.get(p.matriculaId) ?? { total: 0, presentes: 0, validadas: 0 };
      cur.total += 1;
      if (p.presente) cur.presentes += 1;
      if (p.validado) cur.validadas += 1;
      presByMat.set(p.matriculaId, cur);
    }

    const acao = dossie.acaoFormacao as {
      codigoInterno: string;
      titulo: string;
      estado: string;
      dataInicio: string | Date;
      dataFim: string | Date;
    };
    const curso = dossie.curso as {
      codigoUfcd: string | null;
      designacao: string;
      cargaHoras: number;
      modalidade: string;
      objetivos: string | null;
    };

    const formandoIds = [
      ...new Set(dossie.turmas.flatMap((t) => t.matriculas.map((m) => m.formando.id))),
    ];
    const formandoMetaRows = formandoIds.length
      ? await this.prisma.formandoProfile.findMany({
          where: { tenantId, id: { in: formandoIds } },
          select: { id: true, email: true, telefone: true },
        })
      : [];
    const formandoMeta = new Map(formandoMetaRows.map((r) => [r.id, r]));

    const formandos = dossie.turmas.flatMap((t) =>
      t.matriculas.map((m) => {
        const meta = formandoMeta.get(m.formando.id);
        const agg = presByMat.get(m.id);
        const taxa =
          agg && agg.total > 0 ? Math.round((agg.presentes / agg.total) * 100) : null;
        return {
          nif: m.formando.nif,
          nome: m.formando.nome,
          email: meta?.email ?? null,
          telefone: meta?.telefone ?? null,
          turmaCodigo: t.codigo,
          turmaNome: t.nome,
          matriculaId: m.id,
          estadoMatricula: m.estado,
          assiduidade: agg
            ? {
                registosPresenca: agg.total,
                presencasMarcadas: agg.presentes,
                presencasValidadas: agg.validadas,
                taxaPresencaPercent: taxa,
              }
            : null,
        };
      }),
    );

    const sessoes = dossie.cronograma?.sessoes ?? [];
    const planoFormativo = sessoes.map((s) => ({
      numeroSessao: s.numeroSessao,
      data: isoDateOnly(s.data),
      horaInicio: s.horaInicio,
      horaFim: s.horaFim,
      modalidade: s.modalidade,
      estado: s.estado,
      formador: s.formador
        ? { nif: s.formador.nif, nome: s.formador.nomeCompleto }
        : null,
      sumarioAssinado: s.sumarios.some((sum) => sum.imutavel),
      folhaPresencaFechada: s.folhasPresenca.some(
        (f) => Boolean(f.fechadaEm || f.validadaFormadorEm),
      ),
    }));

    const checklistSigo = [
      {
        id: "entidade_nif",
        label: "NIF da entidade formadora",
        ok: Boolean(tenant.nif?.trim()),
      },
      {
        id: "curso_ufcd",
        label: "Código UFCD / módulo (CNQ)",
        ok: Boolean(curso.codigoUfcd?.trim()),
        valor: curso.codigoUfcd ?? undefined,
      },
      {
        id: "acao_identificada",
        label: "Acção com código interno e período",
        ok: Boolean(acao.codigoInterno?.trim()),
      },
      {
        id: "formandos_nif",
        label: "Formandos com NIF (importação SIGO)",
        ok: formandos.length > 0 && formandos.every((f) => f.nif?.trim()),
        detalhe: `${formandos.length} formando(s)`,
      },
      {
        id: "formadores_nif",
        label: "Formador(es) com NIF nas sessões",
        ok: dossie.formadores.length > 0,
      },
      {
        id: "plano_sessoes",
        label: "Plano formativo (sessões registadas)",
        ok: sessoes.length > 0,
      },
      {
        id: "sumarios",
        label: "Sumários assinados (sessões realizadas)",
        ok:
          sessoes.filter((s) => s.estado === "REALIZADA").length === 0 ||
          sessoes
            .filter((s) => s.estado === "REALIZADA")
            .every((s) => s.sumarios.some((sum) => sum.imutavel)),
      },
      {
        id: "assiduidade",
        label: "Assiduidade registada (folhas de presença)",
        ok: sessoes.some((s) => s.folhasPresenca.length > 0),
      },
    ];

    const codigo = acao.codigoInterno;
    const tenantPart = user.tenantSlug ? safeExportSlug(user.tenantSlug) : "tenant";
    const dataPart = new Date().toISOString().slice(0, 10);
    const filename = `sigo-${tenantPart}-${safeExportSlug(codigo)}-${dataPart}.json`;

    const body = {
      $schema: SIGO_EXPORT_SCHEMA,
      aviso: SIGO_AVISO,
      exportadoEm: new Date().toISOString(),
      tenantId,
      tenantSlug: user.tenantSlug,
      exportadoPor: { sub: user.sub, email: user.email, role: user.role },
      entidadeFormadora: {
        nif: tenant.nif,
        denominacao: tenant.legalName,
        slug: tenant.slug,
        estado: tenant.status,
      },
      acaoFormacao: {
        codigoInterno: acao.codigoInterno,
        titulo: acao.titulo,
        estado: acao.estado,
        dataInicio: isoDateOnly(acao.dataInicio),
        dataFim: isoDateOnly(acao.dataFim),
      },
      cursoModulo: {
        codigoUfcd: curso.codigoUfcd,
        designacao: curso.designacao,
        cargaHoras: curso.cargaHoras,
        modalidade: curso.modalidade,
        objetivos: curso.objetivos,
      },
      turmas: dossie.turmas.map((t) => ({
        codigo: t.codigo,
        nome: t.nome,
        totalMatriculas: t.matriculas.length,
      })),
      formadores: dossie.formadores.map((f) => ({
        nif: f.nif,
        nome: f.nomeCompleto,
        email: (f as { email?: string | null }).email ?? null,
      })),
      formandos,
      planoFormativo,
      assiduidadeResumo: dossie.assiduidade,
      checklistSigo: {
        items: checklistSigo,
        concluidos: checklistSigo.filter((i) => i.ok).length,
        total: checklistSigo.length,
      },
      referenciaDossie: {
        checklistScorePercent: (dossie.checklist as { scorePercent: number }).scorePercent,
        geradoEm: dossie.geradoEm,
      },
    };

    return { filename, body };
  }

  async buildFormandosCsv(user: RequestUser, acaoId: string) {
    const pkg = await this.buildSigoJsonPackage(user, acaoId);
    const acao = (pkg.body as { acaoFormacao: { codigoInterno: string } }).acaoFormacao;
    const formandos = (pkg.body as { formandos: Array<Record<string, unknown>> }).formandos;

    const header =
      "NIF;Nome;Email;Telefone;Codigo_Turma;Turma_Nome;Codigo_Acao;Estado_Matricula;Taxa_Presenca_Percent";
    const lines = formandos.map((f) => {
      const ass = f.assiduidade as { taxaPresencaPercent: number | null } | null;
      return [
        csvCell(f.nif as string),
        csvCell(f.nome as string),
        csvCell((f.email as string | null) ?? ""),
        csvCell((f.telefone as string | null) ?? ""),
        csvCell(f.turmaCodigo as string),
        csvCell(f.turmaNome as string),
        csvCell(acao.codigoInterno),
        csvCell(f.estadoMatricula as string),
        csvCell(ass?.taxaPresencaPercent ?? ""),
      ].join(";");
    });

    const csv = `\uFEFF${header}\n${lines.join("\n")}\n`;
    const tenantPart = user.tenantSlug ? safeExportSlug(user.tenantSlug) : "tenant";
    const filename = `sigo-formandos-${tenantPart}-${safeExportSlug(acao.codigoInterno)}-${new Date().toISOString().slice(0, 10)}.csv`;

    return { filename, csv };
  }

  async validateForSigo(user: RequestUser, acaoId: string) {
    const { body } = await this.buildSigoJsonPackage(user, acaoId);
    const validacao = validateSigoPayload(
      body as Parameters<typeof validateSigoPayload>[0],
    );
    return {
      validadoEm: new Date().toISOString(),
      acaoId,
      tenantSlug: user.tenantSlug,
      ...validacao,
      checklistSigo: (body as { checklistSigo: unknown }).checklistSigo,
    };
  }
}
