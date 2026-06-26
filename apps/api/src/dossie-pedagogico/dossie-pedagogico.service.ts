import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

import type { RequestUser } from "../auth/types/access-token-payload";

import { requireTenantId } from "../common/tenant-scope";

import { buildDgertChecklist } from "./dgert-checklist.util";



export type ChecklistItem = {

  id: string;

  label: string;

  ok: boolean;

  detalhe?: string;

  grupo?: string;

  severidade?: string;

  accaoSugerida?: string;

};



/** Identificador do pacote JSON para integrações (SIGO, arquivo, etc.). */

export const DOSSIE_EXPORT_SCHEMA = "nexiforma.dossie_pedagogico.v1";



function safeExportSlug(raw: string): string {

  return raw.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_|_$/g, "").slice(0, 64) || "acao";

}



@Injectable()

export class DossiePedagogicoService {

  constructor(private readonly prisma: PrismaService) {}



  async getByAcaoFormacao(user: RequestUser, acaoId: string) {

    const tenantId = requireTenantId(user);



    const [tenant, acao] = await Promise.all([

      this.prisma.tenant.findUnique({

        where: { id: tenantId },

        select: { nif: true, legalName: true },

      }),

      this.prisma.acaoFormacao.findFirst({

        where: { id: acaoId, tenantId },

        include: {

          curso: true,

          turmas: {

            orderBy: { codigo: "asc" },

            include: {

              matriculas: {

                where: { estado: "ATIVA" },

                include: {

                  formando: {

                    select: { id: true, nome: true, nif: true },

                  },

                },

              },

            },

          },

          cronogramas: {

            orderBy: { versao: "desc" },

            take: 1,

            include: {

              sessoes: {

                orderBy: { numeroSessao: "asc" },

                include: {

                  formador: {

                    select: {

                      id: true,

                      nomeCompleto: true,

                      nif: true,

                      email: true,

                      ccNumero: true,

                      ccpNumero: true,

                    },

                  },

                  sumarios: {

                    orderBy: { createdAt: "desc" },

                    take: 3,

                    select: {

                      id: true,

                      conteudo: true,

                      imutavel: true,

                      assinadoEm: true,

                      createdAt: true,

                    },

                  },

                  folhasPresenca: {

                    select: {

                      id: true,

                      fechadaEm: true,

                      validadaFormadorEm: true,

                      _count: { select: { presencas: true } },

                      presencas: {

                        select: { presente: true, validado: true },

                      },

                    },

                  },

                },

              },

            },

          },

        },

      }),

    ]);



    if (!acao) {

      throw new NotFoundException("Acção de formação não encontrada.");

    }



    const cronograma = acao.cronogramas[0] ?? null;

    const sessoes = cronograma?.sessoes ?? [];



    const formadoresMap = new Map<

      string,

      { id: string; nomeCompleto: string; nif: string }

    >();

    for (const s of sessoes) {

      if (s.formador) {

        formadoresMap.set(s.formador.id, s.formador);

      }

    }



    const formandosAtivos = acao.turmas.flatMap((t) =>

      t.matriculas.map((m) => m.formando),

    );

    const totalMatriculas = formandosAtivos.length;



    let presencasPresentes = 0;

    let presencasTotal = 0;

    for (const s of sessoes) {

      for (const f of s.folhasPresenca) {

        for (const p of f.presencas) {

          presencasTotal += 1;

          if (p.presente) presencasPresentes += 1;

        }

      }

    }



    const dgert = buildDgertChecklist({

      tenantNif: tenant?.nif ?? null,

      curso: acao.curso,

      acao: {

        dataInicio: acao.dataInicio,

        dataFim: acao.dataFim,

        estado: acao.estado,

      },

      cronograma: cronograma

        ? { versao: cronograma.versao, aprovadoEm: cronograma.aprovadoEm }

        : null,

      sessoes,

      formandosAtivos,

      totalMatriculas,

      presencasPresentes,

      presencasTotal,

    });



    return {

      geradoEm: new Date().toISOString(),

      entidade: tenant,

      acaoFormacao: {

        id: acao.id,

        codigoInterno: acao.codigoInterno,

        titulo: acao.titulo,

        estado: acao.estado,

        dataInicio: acao.dataInicio,

        dataFim: acao.dataFim,

      },

      curso: {

        id: acao.curso.id,

        codigoUfcd: acao.curso.codigoUfcd,

        designacao: acao.curso.designacao,

        cargaHoras: acao.curso.cargaHoras,

        modalidade: acao.curso.modalidade,

        objetivos: acao.curso.objetivos,

      },

      turmas: acao.turmas.map((t) => ({

        id: t.id,

        codigo: t.codigo,

        nome: t.nome,

        matriculas: t.matriculas.map((m) => ({

          id: m.id,

          estado: m.estado,

          formando: m.formando,

        })),

      })),

      cronograma: cronograma

        ? {

            id: cronograma.id,

            versao: cronograma.versao,

            aprovadoEm: cronograma.aprovadoEm,

            sessoes: sessoes.map((s) => ({

              id: s.id,

              numeroSessao: s.numeroSessao,

              data: s.data,

              horaInicio: s.horaInicio,

              horaFim: s.horaFim,

              modalidade: s.modalidade,

              estado: s.estado,

              iniciadaEm: s.iniciadaEm,

              terminadaEm: s.terminadaEm,

              formadorPresente: s.formadorPresente,

              formador: s.formador,

              sumarios: s.sumarios,

              folhasPresenca: s.folhasPresenca.map((f) => ({

                id: f.id,

                fechadaEm: f.fechadaEm,

                validadaFormadorEm: f.validadaFormadorEm,

                totalPresencas: f._count.presencas,

                presentes: f.presencas.filter((p) => p.presente).length,

              })),

            })),

          }

        : null,

      formadores: [...formadoresMap.values()],

      assiduidade: {

        presencasRegistadas: presencasTotal,

        presencasMarcadas: presencasPresentes,

        taxaPresenca:

          presencasTotal > 0

            ? Math.round((presencasPresentes / presencasTotal) * 100)

            : null,

      },

      checklist: {

        items: dgert.items,

        grupos: dgert.grupos,

        concluidos: dgert.concluidos,

        total: dgert.total,

        scorePercent: dgert.scorePercent,

        scoreObrigatorioPercent: dgert.scoreObrigatorioPercent,

        concluidosObrigatorios: dgert.concluidosObrigatorios,

        totalObrigatorios: dgert.totalObrigatorios,

        prontoInspecao: dgert.prontoInspecao,

      },

    };

  }



  /** Pacote JSON para download / arquivo / preparação SIGO. */

  async buildExportPackage(user: RequestUser, acaoId: string) {

    const dossie = await this.getByAcaoFormacao(user, acaoId);

    const codigo = String(dossie.acaoFormacao.codigoInterno ?? "acao");

    const tenantPart = user.tenantSlug ? safeExportSlug(user.tenantSlug) : "tenant";

    const dataPart = new Date().toISOString().slice(0, 10);

    const filename = `dossie-${tenantPart}-${safeExportSlug(codigo)}-${dataPart}.json`;



    return {

      filename,

      body: {

        $schema: DOSSIE_EXPORT_SCHEMA,

        exportadoEm: new Date().toISOString(),

        tenantId: user.tenantId,

        tenantSlug: user.tenantSlug,

        exportadoPor: {

          sub: user.sub,

          email: user.email,

          role: user.role,

        },

        dossie,

      },

    };

  }

}


