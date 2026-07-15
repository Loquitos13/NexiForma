import * as argon2 from "argon2";
import { PrismaClient, TenantUserRole } from "../generated/prisma-client";

const prisma = new PrismaClient();

async function hash(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

async function main() {
  const tenantDemo = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {
      legalName: "Demonstração NexiForma, Lda.",
      status: "TRIAL",
    },
    create: {
      slug: "demo",
      legalName: "Demonstração NexiForma, Lda.",
      nif: "508504560",
      status: "TRIAL",
    },
  });

  const planStarter = await prisma.subscriptionPlan.upsert({
    where: { code: "starter" },
    update: { active: true },
    create: {
      code: "starter",
      name: "Starter",
      priceCentsMonthly: 4900,
      maxActiveUsers: 5,
      features: { dossie: true, compliance: true },
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { code: "pro" },
    update: { active: true, name: "Business" },
    create: {
      code: "pro",
      name: "Business",
      priceCentsMonthly: 12900,
      maxActiveUsers: 25,
      features: { dossie: true, compliance: true, sigo: true, billing: true },
    },
  });
  const planEnterprise = await prisma.subscriptionPlan.upsert({
    where: { code: "enterprise" },
    update: { active: true },
    create: {
      code: "enterprise",
      name: "Enterprise",
      priceCentsMonthly: 29900,
      maxActiveUsers: null,
      features: { all: true },
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { code: "modular" },
    update: { active: true },
    create: {
      code: "modular",
      name: "Módulos à la carte",
      priceCentsMonthly: 0,
      maxActiveUsers: null,
      features: { modules_only: true },
    },
  });

  const demoCustomAddons: string[] = [];

  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  const demoSubCount = await prisma.tenantSubscription.count({
    where: { tenantId: tenantDemo.id },
  });
  if (demoSubCount === 0) {
    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenantDemo.id,
        planId: planEnterprise.id,
        status: "TRIALING",
        currentPeriodStart: now,
        currentPeriodEnd: end,
        billingEmail: "manager@demo.local",
        customAddons: demoCustomAddons,
      },
    });
  } else {
    await prisma.tenantSubscription.updateMany({
      where: { tenantId: tenantDemo.id },
      data: {
        planId: planEnterprise.id,
        status: "TRIALING",
        customAddons: demoCustomAddons,
      },
    });
  }

  const platformPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "super123#";
  await prisma.platformUser.upsert({
    where: { email: "super@nexiforma.local" },
    update: {
      passwordHash: await hash(platformPassword),
      displayName: "Super Administrador",
      active: true,
    },
    create: {
      email: "super@nexiforma.local",
      passwordHash: await hash(platformPassword),
      displayName: "Super Administrador",
    },
  });

  const managerPass = process.env.SEED_MANAGER_PASSWORD ?? "manager123";
  const formadorPass = process.env.SEED_FORMADOR_PASSWORD ?? "trainer123";
  const formandoPass = process.env.SEED_FORMANDO_PASSWORD ?? "user123";
  const comercialPass = process.env.SEED_COMERCIAL_PASSWORD ?? "com123";

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenantDemo.id, email: "manager@demo.local" },
    },
    update: {
      passwordHash: await hash(managerPass),
      displayName: "Gestão do tenant",
      role: TenantUserRole.ADMIN,
      active: true,
    },
    create: {
      tenantId: tenantDemo.id,
      email: "manager@demo.local",
      passwordHash: await hash(managerPass),
      displayName: "Gestão do tenant",
      role: TenantUserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenantDemo.id, email: "formador@demo.local" },
    },
    update: {
      passwordHash: await hash(formadorPass),
      displayName: "Maria Formadora",
      role: TenantUserRole.FORMADOR,
      active: true,
    },
    create: {
      tenantId: tenantDemo.id,
      email: "formador@demo.local",
      passwordHash: await hash(formadorPass),
      displayName: "Maria Formadora",
      role: TenantUserRole.FORMADOR,
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenantDemo.id, email: "comercial@demo.local" },
    },
    update: {
      passwordHash: await hash(comercialPass),
      displayName: "Ana Comercial",
      role: TenantUserRole.COMERCIAL,
      active: true,
    },
    create: {
      tenantId: tenantDemo.id,
      email: "comercial@demo.local",
      passwordHash: await hash(comercialPass),
      displayName: "Ana Comercial",
      role: TenantUserRole.COMERCIAL,
    },
  });

  /** --- Dados MVP de demonstração (curso → ação → turma) --- */
  const cursoDesignacao = "UFCD 7834 – Sensibilização á qualidade na restauração";

  let cursoDemo = await prisma.curso.findFirst({
    where: { tenantId: tenantDemo.id, designacao: cursoDesignacao },
  });

  if (!cursoDemo) {
    cursoDemo = await prisma.curso.create({
      data: {
        tenantId: tenantDemo.id,
        codigoUfcd: "7834",
        designacao: cursoDesignacao,
        cargaHoras: 50,
        modalidade: "presencial",
        objetivos:
          "Conhecer conceitos-base de segurança alimentar e boas práticas no contexto de restauração (exemplo NexiForma)",
      },
    });
  }

  const codigoAf = "NF-DEMO-2025-AF01";
  let afDemo = await prisma.acaoFormacao.findFirst({
    where: { tenantId: tenantDemo.id, codigoInterno: codigoAf },
  });

  if (!afDemo) {
    afDemo = await prisma.acaoFormacao.create({
      data: {
        tenantId: tenantDemo.id,
        cursoId: cursoDemo.id,
        codigoInterno: codigoAf,
        titulo: "Demonstração NexiForma – ciclo DGERT exemplo",
        dataInicio: new Date("2025-09-01T00:00:00.000Z"),
        dataFim: new Date("2025-12-15T00:00:00.000Z"),
        estado: "EM_CURSO",
      },
    });
  }

  const turmaDemo = await prisma.turma.upsert({
    where: {
      tenantId_acaoFormacaoId_codigo: {
        tenantId: tenantDemo.id,
        acaoFormacaoId: afDemo.id,
        codigo: "T-A",
      },
    },
    update: { nome: "Turma A (manhã)" },
    create: {
      tenantId: tenantDemo.id,
      acaoFormacaoId: afDemo.id,
      codigo: "T-A",
      nome: "Turma A (manhã)",
    },
  });

  const nifFormandoDemo = "234567890";
  let formandoDemo = await prisma.formandoProfile.findFirst({
    where: { tenantId: tenantDemo.id, nif: nifFormandoDemo },
  });
  if (!formandoDemo) {
    formandoDemo = await prisma.formandoProfile.create({
      data: {
        tenantId: tenantDemo.id,
        nome: "João Formando Demo",
        nif: nifFormandoDemo,
        email: "formando.demo@example.local",
      },
    });
  }

  const formandoUser = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenantDemo.id, email: "formando@demo.local" },
    },
    update: {
      passwordHash: await hash(formandoPass),
      displayName: "João Formando Demo",
      role: TenantUserRole.FORMANDO,
      active: true,
    },
    create: {
      tenantId: tenantDemo.id,
      email: "formando@demo.local",
      passwordHash: await hash(formandoPass),
      displayName: "João Formando Demo",
      role: TenantUserRole.FORMANDO,
    },
  });

  if (!formandoDemo.userId) {
    formandoDemo = await prisma.formandoProfile.update({
      where: { id: formandoDemo.id },
      data: { userId: formandoUser.id, email: "formando@demo.local" },
    });
  }

  const matriculaExistente = await prisma.matricula.findFirst({
    where: { turmaId: turmaDemo.id, formandoId: formandoDemo.id },
  });
  if (!matriculaExistente) {
    await prisma.matricula.create({
      data: {
        tenantId: tenantDemo.id,
        turmaId: turmaDemo.id,
        formandoId: formandoDemo.id,
      },
    });
  } else {
    await prisma.matricula.update({
      where: { id: matriculaExistente.id },
      data: { estado: "ATIVA" },
    });
  }

  const formadorUser = await prisma.user.findFirst({
    where: { tenantId: tenantDemo.id, email: "formador@demo.local" },
  });

  let formadorProfile = formadorUser
    ? await prisma.formadorProfile.findFirst({
        where: { tenantId: tenantDemo.id, userId: formadorUser.id },
      })
    : null;

  if (formadorUser && !formadorProfile) {
    formadorProfile = await prisma.formadorProfile.create({
      data: {
        tenantId: tenantDemo.id,
        userId: formadorUser.id,
        nomeCompleto: "Maria Formadora",
        nif: "198765432",
        email: "formador@demo.local",
      },
    });
  }

  let cronogramaDemo = await prisma.cronograma.findFirst({
    where: { tenantId: tenantDemo.id, acaoFormacaoId: afDemo.id, versao: 1 },
  });
  if (!cronogramaDemo) {
    cronogramaDemo = await prisma.cronograma.create({
      data: {
        tenantId: tenantDemo.id,
        acaoFormacaoId: afDemo.id,
        versao: 1,
      },
    });
  }

  let sessaoDemo = await prisma.sessaoFormacao.findFirst({
    where: { cronogramaId: cronogramaDemo.id, numeroSessao: 1 },
  });
  if (!sessaoDemo) {
    sessaoDemo = await prisma.sessaoFormacao.create({
      data: {
        tenantId: tenantDemo.id,
        cronogramaId: cronogramaDemo.id,
        numeroSessao: 1,
        data: new Date("2025-09-15T00:00:00.000Z"),
        horaInicio: "09:00",
        horaFim: "12:30",
        modalidade: "presencial",
        estado: "REALIZADA",
        formadorId: formadorProfile?.id ?? null,
        lmsAtivo: true,
        minutosPresencaMin: 60,
      },
    });
  } else {
    await prisma.sessaoFormacao.update({
      where: { id: sessaoDemo.id },
      data: {
        lmsAtivo: true,
        zoomMeetingId: null,
        teamsMeetingId: null,
        salaJoinUrl: null,
        minutosPresencaMin: 60,
      },
    });
  }

  let sessaoOnline = await prisma.sessaoFormacao.findFirst({
    where: { cronogramaId: cronogramaDemo.id, numeroSessao: 2 },
  });
  if (!sessaoOnline) {
    sessaoOnline = await prisma.sessaoFormacao.create({
      data: {
        tenantId: tenantDemo.id,
        cronogramaId: cronogramaDemo.id,
        numeroSessao: 2,
        data: new Date("2025-10-01T00:00:00.000Z"),
        horaInicio: "14:00",
        horaFim: "17:00",
        modalidade: "b-learning",
        estado: "AGENDADA",
        formadorId: formadorProfile?.id ?? null,
        lmsAtivo: true,
        minutosPresencaMin: 90,
      },
    });
  } else {
    await prisma.sessaoFormacao.update({
      where: { id: sessaoOnline.id },
      data: {
        lmsAtivo: true,
        teamsMeetingId: null,
        zoomMeetingId: null,
        salaJoinUrl: null,
        minutosPresencaMin: 90,
      },
    });
  }

  const matriculaDemo = await prisma.matricula.findFirst({
    where: { turmaId: turmaDemo.id, formandoId: formandoDemo.id },
  });

  if (matriculaDemo) {
    const acessosCount = await prisma.acessoLms.count({
      where: { matriculaId: matriculaDemo.id, sessaoFormacaoId: sessaoDemo.id },
    });
    if (acessosCount === 0) {
      await prisma.acessoLms.createMany({
        data: [
          {
            tenantId: tenantDemo.id,
            matriculaId: matriculaDemo.id,
            sessaoFormacaoId: sessaoDemo.id,
            evento: "join",
          },
          {
            tenantId: tenantDemo.id,
            matriculaId: matriculaDemo.id,
            sessaoFormacaoId: sessaoDemo.id,
            evento: "heartbeat",
            duracaoSegundos: 3600,
          },
          {
            tenantId: tenantDemo.id,
            matriculaId: matriculaDemo.id,
            sessaoFormacaoId: sessaoDemo.id,
            evento: "leave",
            duracaoSegundos: 600,
          },
        ],
      });
    }

    let folhaDemo = await prisma.folhaPresenca.findFirst({
      where: { tenantId: tenantDemo.id, sessaoId: sessaoDemo.id },
    });
    if (!folhaDemo) {
      folhaDemo = await prisma.folhaPresenca.create({
        data: {
          tenantId: tenantDemo.id,
          sessaoId: sessaoDemo.id,
          origem: "manual",
        },
      });
      await prisma.presenca.create({
        data: {
          tenantId: tenantDemo.id,
          folhaPresencaId: folhaDemo.id,
          matriculaId: matriculaDemo.id,
          presente: true,
          validado: true,
          origem: "manual",
        },
      });
    }
  }

  const sumarioDemo = await prisma.sumario.findFirst({
    where: { tenantId: tenantDemo.id, sessaoId: sessaoDemo.id },
  });
  if (!sumarioDemo) {
    await prisma.sumario.create({
      data: {
        tenantId: tenantDemo.id,
        sessaoId: sessaoDemo.id,
        conteudo:
          "Sessão introdutória: conceitos de higiene e segurança alimentar no sector da restauração; apresentação dos objectivos da UFCD e dinâmica de grupo (demonstração NexiForma).",
        imutavel: true,
        assinadoEm: new Date("2025-09-15T14:00:00.000Z"),
        assinaturaRef: "seed-demo",
      },
    });
  }

  const modulosCount = await prisma.moduloConteudo.count({
    where: { tenantId: tenantDemo.id, cursoId: cursoDemo.id },
  });
  if (modulosCount === 0) {
    await prisma.moduloConteudo.createMany({
      data: [
        {
          tenantId: tenantDemo.id,
          cursoId: cursoDemo.id,
          titulo: "Introdução à segurança alimentar",
          tipo: "TEXTO",
          ordem: 0,
          conteudoHtml:
            "<p>Conceitos base de HACCP e boas práticas de higiene na restauração (conteúdo demo NexiForma).</p>",
          publicado: true,
        },
        {
          tenantId: tenantDemo.id,
          cursoId: cursoDemo.id,
          titulo: "Vídeo – lavagem de mãos",
          tipo: "VIDEO",
          ordem: 1,
          urlOuRef: "https://example.com/demo/lavagem-maos.mp4",
          duracaoMin: 8,
          publicado: true,
        },
        {
          tenantId: tenantDemo.id,
          cursoId: cursoDemo.id,
          titulo: "Quiz – boas práticas",
          tipo: "QUIZ",
          ordem: 2,
          publicado: true,
        },
        {
          tenantId: tenantDemo.id,
          cursoId: cursoDemo.id,
          titulo: "SCORM – demo interactivo",
          tipo: "SCORM",
          ordem: 3,
          urlOuRef: "/scorm-demo/index.html",
          metadata: { scormVersion: "1.2", launchUrl: "/scorm-demo/index.html" },
          publicado: true,
        },
      ],
    });
  } else {
    const scormExists = await prisma.moduloConteudo.findFirst({
      where: { tenantId: tenantDemo.id, cursoId: cursoDemo.id, tipo: "SCORM" },
    });
    if (!scormExists) {
      await prisma.moduloConteudo.create({
        data: {
          tenantId: tenantDemo.id,
          cursoId: cursoDemo.id,
          titulo: "SCORM – demo interactivo",
          tipo: "SCORM",
          ordem: 3,
          urlOuRef: "/scorm-demo/index.html",
          metadata: { scormVersion: "1.2", launchUrl: "/scorm-demo/index.html" },
          publicado: true,
        },
      });
    }
  }

  // Fase 10 – CRM demo: entidade cliente, proposta, CC/CCP formador
  const entidadeDemo = await prisma.entidadeCliente.upsert({
    where: { tenantId_nif: { tenantId: tenantDemo.id, nif: "501234567" } },
    update: {
      nome: "Empresa Cliente Demo Lda",
      email: "contacto@cliente-demo.local",
      moradaFiscal: "Rua das Flores 12, 4000-001 Porto",
    },
    create: {
      tenantId: tenantDemo.id,
      nif: "501234567",
      nome: "Empresa Cliente Demo Lda",
      email: "contacto@cliente-demo.local",
      telefone: "+351912345678",
      moradaFiscal: "Rua das Flores 12, 4000-001 Porto",
    },
  });

  if (formandoDemo && !formandoDemo.entidadeClienteId) {
    await prisma.formandoProfile.update({
      where: { id: formandoDemo.id },
      data: { entidadeClienteId: entidadeDemo.id },
    });
  }

  if (formadorProfile) {
    const ccExpira = new Date();
    ccExpira.setDate(ccExpira.getDate() + 45);
    const ccpExpira = new Date();
    ccpExpira.setDate(ccExpira.getDate() + 120);
    formadorProfile = await prisma.formadorProfile.update({
      where: { id: formadorProfile.id },
      data: {
        ccNumero: "CC-DEMO-123",
        ccpNumero: "CCP-DEMO-456",
        ccValidade: ccExpira,
        ccpValidade: ccpExpira,
      },
    });
  }

  if (cursoDemo) {
    const comercialDemo = await prisma.user.findFirst({
      where: { tenantId: tenantDemo.id, email: "comercial@demo.local" },
      select: { id: true },
    });
    await prisma.propostaComercial.upsert({
      where: { tenantId_codigo: { tenantId: tenantDemo.id, codigo: "PROP-DEMO-001" } },
      update: {
        titulo: "Formação Excelência Operacional – 2026",
        ...(comercialDemo
          ? {
              criadoPorUserId: comercialDemo.id,
              enviadaPorUserId: comercialDemo.id,
              enviadaEm: new Date(),
            }
          : {}),
      },
      create: {
        tenantId: tenantDemo.id,
        entidadeClienteId: entidadeDemo.id,
        codigo: "PROP-DEMO-001",
        titulo: "Formação Excelência Operacional – 2026",
        descricao: "Proposta demo para turma fechada – 12 formandos.",
        valorCentavos: 480000,
        estado: "ENVIADA",
        validadeAte: new Date("2026-12-31"),
        cursoId: cursoDemo.id,
        ...(comercialDemo
          ? {
              criadoPorUserId: comercialDemo.id,
              enviadaPorUserId: comercialDemo.id,
              enviadaEm: new Date(),
            }
          : {}),
      },
    });
  }

  // Sugestões IA comerciais demo (Enterprise)
  const sugestoesDemo = [
    {
      tipo: "FOLLOW_UP" as const,
      titulo: "Follow-up proposta enviada",
      descricao:
        "A proposta PROP-DEMO-001 foi enviada há 5 dias sem resposta. Agendar contacto telefónico com o decisor.",
    },
    {
      tipo: "UPSELL" as const,
      titulo: "Upsell módulo avançado",
      descricao:
        "Cliente com histórico de formações operacionais - propor UFCD 0374 (Excelência operacional) para equipa alargada.",
    },
    {
      tipo: "RENOVACAO" as const,
      titulo: "Renovação formação anual",
      descricao:
        "Renovar pacote de formação HACCP para 2027 antes do vencimento do certificado da equipa de cozinha.",
    },
  ];
  for (const s of sugestoesDemo) {
    const existing = await prisma.sugestaoIaComercial.findFirst({
      where: { tenantId: tenantDemo.id, titulo: s.titulo },
    });
    if (!existing) {
      await prisma.sugestaoIaComercial.create({
        data: {
          tenantId: tenantDemo.id,
          entidadeClienteId: entidadeDemo.id,
          tipo: s.tipo,
          titulo: s.titulo,
          descricao: s.descricao,
          score: 0.85,
          confianca: 0.78,
          engine: "seed",
          estado: "PENDENTE",
        },
      });
    }
  }

  // Fases 11–13 – catálogo UFCD, integrações, quiz demo
  const ufcdSeed = [
    { codigo: "0113", designacao: "Higiene e segurança alimentar", area: "Turismo", cargaHoras: 25, nivelQnq: "3" },
    { codigo: "0374", designacao: "Excelência operacional", area: "Gestão", cargaHoras: 50, nivelQnq: "4" },
    { codigo: "0489", designacao: "Comunicação e atendimento", area: "Serviços", cargaHoras: 25, nivelQnq: "3" },
  ];
  for (const u of ufcdSeed) {
    await prisma.catalogoUfcd.upsert({
      where: { codigo: u.codigo },
      update: { designacao: u.designacao, activo: true },
      create: u,
    });
  }

  if (cursoDemo && !cursoDemo.codigoUfcd) {
    await prisma.curso.update({
      where: { id: cursoDemo.id },
      data: { codigoUfcd: "0113" },
    });
  }

  for (const provider of ["ZOOM", "TEAMS", "MOODLE"] as const) {
    await prisma.tenantIntegracao.upsert({
      where: { tenantId_provider: { tenantId: tenantDemo.id, provider } },
      update: {},
      create: {
        tenantId: tenantDemo.id,
        provider,
        mode: "DISABLED",
        config: {},
      },
    });
  }

  const quizModulo = await prisma.moduloConteudo.findFirst({
    where: { tenantId: tenantDemo.id, cursoId: cursoDemo?.id, tipo: "QUIZ" },
  });
  if (quizModulo) {
    const perguntasCount = await prisma.quizPergunta.count({
      where: { tenantId: tenantDemo.id, moduloId: quizModulo.id },
    });
    if (perguntasCount === 0) {
      await prisma.quizPergunta.createMany({
        data: [
          {
            tenantId: tenantDemo.id,
            moduloId: quizModulo.id,
            enunciado: "Qual a temperatura mínima recomendada para conservação de alimentos refrigerados?",
            ordem: 0,
            pontos: 1,
            opcoes: [
              { id: "a", texto: "0°C a 4°C", correta: true },
              { id: "b", texto: "10°C a 15°C" },
              { id: "c", texto: "18°C a 22°C" },
            ],
          },
          {
            tenantId: tenantDemo.id,
            moduloId: quizModulo.id,
            enunciado: "A lavagem de mãos deve durar pelo menos:",
            ordem: 1,
            pontos: 1,
            opcoes: [
              { id: "a", texto: "5 segundos" },
              { id: "b", texto: "20 segundos", correta: true },
              { id: "c", texto: "2 minutos" },
            ],
          },
        ],
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("Seed NexiForma concluído.");
  // eslint-disable-next-line no-console
  console.log("  Super admin:", "super@nexiforma.local", "(definir SEED_SUPERADMIN_PASSWORD em produção)");
  // eslint-disable-next-line no-console
  console.log("  Tenant demo slug: demo (plano Enterprise) – manager@demo.local / formador@demo.local / formando@demo.local / comercial@demo.local");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
