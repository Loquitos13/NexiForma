import {
  ALERTA_PRESENCA,
  cursoExigeEmailPresenca,
  resolverEmailPresencaFormando,
} from "@nexiforma/shared";
import type { PrismaService } from "../prisma/prisma.service";

type FormandoComEmail = {
  id: string;
  emailPresenca: string | null;
  email: string | null;
  user: { email: string } | null;
};

type FormandoEmailRow = {
  id: string;
  emailPresenca: string | null;
  email: string | null;
  user: { email: string } | null;
};

export function emailPresencaEfectivoDeFormando(formando: FormandoEmailRow): string | null {
  return resolverEmailPresencaFormando({
    emailPresenca: formando.emailPresenca,
    emailConta: formando.user?.email,
    emailContacto: formando.email,
  });
}

/** Turma com componente online (modalidade ou sessões LMS). */
export async function turmaExigeEmailPresenca(
  prisma: PrismaService,
  tenantId: string,
  turmaId: string,
): Promise<boolean> {
  const turma = await prisma.turma.findFirst({
    where: { id: turmaId, tenantId },
    select: {
      acaoFormacao: {
        select: {
          curso: { select: { modalidade: true } },
          cronogramas: {
            select: {
              sessoes: {
                where: { lmsAtivo: true, estado: { not: "CANCELADA" } },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!turma) return false;
  if (cursoExigeEmailPresenca(turma.acaoFormacao.curso.modalidade)) return true;
  return turma.acaoFormacao.cronogramas.some((c) => c.sessoes.length > 0);
}

/** Encontra formando cujo email efectivo de presença coincide com o participante da reunião. */
export async function findFormandoPorEmailReuniao(
  prisma: PrismaService,
  tenantId: string,
  participantEmail: string,
): Promise<FormandoComEmail | null> {
  const normalizado = participantEmail.trim().toLowerCase();
  if (!normalizado) return null;

  const candidatos = await prisma.formandoProfile.findMany({
    where: {
      tenantId,
      OR: [
        { emailPresenca: { equals: participantEmail, mode: "insensitive" } },
        { user: { email: { equals: participantEmail, mode: "insensitive" } } },
        { email: { equals: participantEmail, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      emailPresenca: true,
      email: true,
      user: { select: { email: true } },
    },
  });

  for (const f of candidatos) {
    const efectivo = emailPresencaEfectivoDeFormando(f);
    if (efectivo?.toLowerCase() === normalizado) {
      return f;
    }
  }

  return null;
}

/**
 * Participante reconhecido no tenant mas com email diferente do exigido para presença.
 * Ex.: entrou com email da conta quando o gestor definiu outro emailPresenca.
 */
export async function detectarEmailReuniaoIncorreto(
  prisma: PrismaService,
  tenantId: string,
  sessaoId: string,
  participantEmail: string,
): Promise<{
  formandoId: string;
  matriculaId: string;
  emailEsperado: string;
  emailParticipante: string;
} | null> {
  const normalizado = participantEmail.trim().toLowerCase();
  if (!normalizado) return null;

  const candidatos = await prisma.formandoProfile.findMany({
    where: {
      tenantId,
      OR: [
        { user: { email: { equals: participantEmail, mode: "insensitive" } } },
        { email: { equals: participantEmail, mode: "insensitive" } },
        { emailPresenca: { equals: participantEmail, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      emailPresenca: true,
      email: true,
      user: { select: { email: true } },
    },
  });

  for (const f of candidatos) {
    const emailEsperado = emailPresencaEfectivoDeFormando(f);
    if (!emailEsperado || emailEsperado.toLowerCase() === normalizado) continue;

    const matricula = await prisma.matricula.findFirst({
      where: {
        tenantId,
        formandoId: f.id,
        estado: "ATIVA",
        turma: {
          acaoFormacao: {
            cronogramas: { some: { sessoes: { some: { id: sessaoId } } } },
          },
        },
      },
      select: { id: true },
    });
    if (!matricula) continue;

    return {
      formandoId: f.id,
      matriculaId: matricula.id,
      emailEsperado,
      emailParticipante: participantEmail.trim(),
    };
  }

  return null;
}

export async function registarAlertaEmailReuniaoIncorreto(
  prisma: PrismaService,
  tenantId: string,
  sessaoId: string,
  matriculaId: string,
  emailEsperado: string,
  emailParticipante: string,
) {
  await prisma.acessoLms.create({
    data: {
      tenantId,
      matriculaId,
      sessaoFormacaoId: sessaoId,
      evento: "alert",
      duracaoSegundos: null,
      metadata: {
        tipo: ALERTA_PRESENCA.EMAIL_REUNIAO_INCORRETO,
        emailEsperado,
        emailParticipante,
        origem: "webhook",
      },
    },
  });
}
