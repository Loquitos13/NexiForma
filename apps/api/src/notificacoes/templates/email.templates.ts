/**
 * Templates de email profissionais – NexiForma
 * Fragmentos HTML envolvidos por MailService (wrapEmailHtml).
 */

import {
  emailButton,
  emailButtonRow,
  emailDataRow,
  emailDataTable,
  emailHeading,
  emailInfoBox,
  emailMuted,
  emailParagraph,
  escapeHtml,
} from "../../mail/email-layout.util";

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

function cumprimento(nome: string): string {
  return emailParagraph(`Caro(a) <strong>${escapeHtml(nome)}</strong>,`);
}

function assinatura(entidade?: string): string {
  const quem = entidade?.trim() || "Equipa NexiForma";
  return emailParagraph(
    `Com os melhores cumprimentos,<br/><strong>${escapeHtml(quem)}</strong>`,
  );
}

function listaHtml(itens: string[]): string {
  if (!itens.length) return "";
  return (
    `<ul style="margin:0 0 16px;padding-left:20px;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:15px;line-height:1.55;color:#334155;">` +
    itens.map((i) => `<li style="margin:0 0 6px;">${escapeHtml(i)}</li>`).join("") +
    `</ul>`
  );
}

export class EmailTemplates {
  /** Atribuição de formador a sessões/acção – CTA «Abrir ação» (sem URL visível no HTML). */
  static formadorAtribuicaoSessoes(params: {
    nomeFormador: string;
    acaoLabel: string;
    entidadeFormadora?: string;
    acaoUrl: string;
  }): EmailTemplate {
    const entidade = params.entidadeFormadora?.trim() || "NexiForma";
    return {
      subject: `Atribuição de acção de formação – ${params.acaoLabel}`,
      text:
        `Caro(a) ${params.nomeFormador},\n\n` +
        `Foi-lhe atribuída a acção de formação «${params.acaoLabel}».\n\n` +
        `Aceda à acção no portal:\n${params.acaoUrl}\n\n` +
        `Com os melhores cumprimentos,\n${entidade}\n`,
      html:
        cumprimento(params.nomeFormador) +
        emailParagraph(
          `Foi-lhe atribuída a acção de formação ` +
            `<strong>«${escapeHtml(params.acaoLabel)}»</strong>.`,
        ) +
        emailParagraph("Utilize o botão abaixo para abrir a acção no portal.") +
        emailButtonRow(emailButton("Abrir ação", params.acaoUrl, "primary")) +
        emailMuted("Se o botão não funcionar, utilize o link da versão em texto desta mensagem.") +
        assinatura(entidade),
    };
  }

  /** Formando inscrito numa acção – lembrete de documentos. */
  static formandoInscritoAcao(params: {
    nomeFormando: string;
    acaoLabel: string;
    turmaCodigo?: string;
    entidadeFormadora?: string;
    documentosInscricao?: string[];
    documentosUniversais?: string[];
    portalUrl: string;
  }): EmailTemplate {
    const entidade = params.entidadeFormadora?.trim() || "NexiForma";
    const docsInscricao = params.documentosInscricao ?? [];
    const docsUniv = params.documentosUniversais ?? [];
    const temDocs = docsInscricao.length > 0 || docsUniv.length > 0;

    const docsText =
      (docsUniv.length
        ? `\nDocumentos do perfil (obrigatórios):\n${docsUniv.map((d) => `• ${d}`).join("\n")}\n`
        : "") +
      (docsInscricao.length
        ? `\nDocumentos desta inscrição:\n${docsInscricao.map((d) => `• ${d}`).join("\n")}\n`
        : "");

    return {
      subject: `Inscrição confirmada – ${params.acaoLabel}`,
      text:
        `Caro(a) ${params.nomeFormando},\n\n` +
        `A sua inscrição na formação «${params.acaoLabel}»` +
        (params.turmaCodigo ? ` (turma ${params.turmaCodigo})` : "") +
        ` foi registada.\n\n` +
        (temDocs
          ? `Antes do início da formação, deve carregar na plataforma os documentos necessários:\n` +
            docsText +
            `\n`
          : `Antes do início da formação, confirme no portal se tem documentos pendentes.\n\n`) +
        `Aceda ao portal:\n${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\n${entidade}\n`,
      html:
        cumprimento(params.nomeFormando) +
        emailParagraph(
          `A sua inscrição na formação <strong>«${escapeHtml(params.acaoLabel)}»</strong>` +
            (params.turmaCodigo
              ? ` (turma <strong>${escapeHtml(params.turmaCodigo)}</strong>)`
              : "") +
            ` foi registada com sucesso.`,
        ) +
        emailParagraph(
          "Para concluir o processo, deve inserir na plataforma os documentos necessários " +
            "antes do início da formação.",
        ) +
        (docsUniv.length
          ? emailInfoBox(
              `<p style="margin:0 0 8px;"><strong>Documentos do perfil</strong></p>` +
                listaHtml(docsUniv),
              "#2563eb",
            )
          : "") +
        (docsInscricao.length
          ? emailInfoBox(
              `<p style="margin:0 0 8px;"><strong>Documentos desta inscrição</strong></p>` +
                listaHtml(docsInscricao),
              "#0d9488",
            )
          : "") +
        emailButtonRow(emailButton("Abrir portal", params.portalUrl, "primary")) +
        emailMuted(
          "Se já enviou os documentos, pode ignorar este aviso. Em caso de dúvida, contacte a entidade formadora.",
        ) +
        assinatura(entidade),
    };
  }

  /** Cargo de formador atribuído – pedido de documentos obrigatórios. */
  static formadorCargoAtribuido(params: {
    nomeUtilizador: string;
    entidadeFormadora: string;
    documentosObrigatorios: string[];
    portalUrl: string;
  }): EmailTemplate {
    const docs = params.documentosObrigatorios;
    return {
      subject: `Cargo de formador – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeUtilizador},\n\n` +
        `Foi-lhe atribuído o cargo de formador em «${params.entidadeFormadora}».\n\n` +
        `Solicitamos que carregue na plataforma os documentos obrigatórios:\n` +
        docs.map((d) => `• ${d}`).join("\n") +
        `\n\nAceda ao portal:\n${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\n${params.entidadeFormadora}\n`,
      html:
        cumprimento(params.nomeUtilizador) +
        emailParagraph(
          `Foi-lhe atribuído o cargo de <strong>formador</strong> em ` +
            `<strong>${escapeHtml(params.entidadeFormadora)}</strong>.`,
        ) +
        emailParagraph(
          "Para poder operar sessões de formação, deve inserir na plataforma os documentos obrigatórios:",
        ) +
        emailInfoBox(
          `<p style="margin:0 0 8px;"><strong>Documentos a carregar</strong></p>` +
            listaHtml(docs.length ? docs : ["Curriculum Vitae", "Documento de identificação", "CCP"]),
          "#d97706",
        ) +
        emailButtonRow(emailButton("Carregar documentos", params.portalUrl, "primary")) +
        emailMuted(
          "Sem estes documentos, o acesso às funções de formador pode ficar limitado até à validação.",
        ) +
        assinatura(params.entidadeFormadora),
    };
  }

  /** Confirmação de email (utilizador registado pela administração). */
  static confirmarEmail(params: {
    nomeUtilizador: string;
    entidadeFormadora: string;
    confirmUrl: string;
    expiresHours: number;
  }): EmailTemplate {
    return {
      subject: `Confirme o seu email – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeUtilizador},\n\n` +
        `Foi registado(a) na plataforma NexiForma da entidade «${params.entidadeFormadora}».\n\n` +
        `Por segurança, confirme o seu endereço de email antes de iniciar sessão:\n` +
        `${params.confirmUrl}\n\n` +
        `O link é válido durante ${params.expiresHours} horas.\n\n` +
        `Se não esperava este registo, ignore este email e contacte a entidade formadora.\n\n` +
        `Com os melhores cumprimentos,\n${params.entidadeFormadora}\n`,
      html:
        cumprimento(params.nomeUtilizador) +
        emailParagraph(
          `Foi registado(a) na plataforma <strong>NexiForma</strong> da entidade ` +
            `<strong>${escapeHtml(params.entidadeFormadora)}</strong>.`,
        ) +
        emailParagraph(
          "Por segurança, confirme o seu endereço de email antes de iniciar sessão.",
        ) +
        emailButtonRow(emailButton("Confirmar email", params.confirmUrl, "primary")) +
        emailMuted(
          `O link é válido durante ${params.expiresHours} horas. ` +
            "Se não esperava este registo, ignore este email.",
        ) +
        assinatura(params.entidadeFormadora),
    };
  }

  /** Convite de utilizador / registo na plataforma. */
  static conviteUtilizador(params: {
    nomeUtilizador: string;
    entidadeFormadora: string;
    papel: string;
    linkConvite: string;
    documentosObrigatorios?: string[];
  }): EmailTemplate {
    const docs = params.documentosObrigatorios ?? [];
    const isFormador = docs.length > 0;
    return {
      subject: `Convite NexiForma – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeUtilizador},\n\n` +
        `Foi convidado(a) a aceder à plataforma NexiForma da entidade «${params.entidadeFormadora}».\n\n` +
        `Cargo: ${params.papel}\n\n` +
        `Para activar a conta, confirmar o email e definir a palavra-passe:\n${params.linkConvite}\n\n` +
        (isFormador
          ? `Após activar a conta, carregue os documentos obrigatórios:\n` +
            docs.map((d) => `• ${d}`).join("\n") +
            `\n\n`
          : "") +
        `O link é válido durante 7 dias.\n\n` +
        `Com os melhores cumprimentos,\n${params.entidadeFormadora}\n`,
      html:
        cumprimento(params.nomeUtilizador) +
        emailParagraph(
          `Foi convidado(a) a aceder à plataforma <strong>NexiForma</strong> da entidade ` +
            `<strong>${escapeHtml(params.entidadeFormadora)}</strong>.`,
        ) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Entidade", escapeHtml(params.entidadeFormadora)) +
              emailDataRow("Cargo", escapeHtml(params.papel)),
          ),
          "#2563eb",
        ) +
        emailParagraph(
          "Clique no botão abaixo para <strong>activar a conta</strong>, confirmar o email e definir a palavra-passe.",
        ) +
        emailButtonRow(emailButton("Activar conta", params.linkConvite, "primary")) +
        (isFormador
          ? emailParagraph(
              "Após a activação, solicitamos que carregue os documentos obrigatórios do formador:",
            ) +
            emailInfoBox(listaHtml(docs), "#d97706")
          : "") +
        emailMuted("O link de convite expira em 7 dias.") +
        assinatura(params.entidadeFormadora),
    };
  }

  /** @deprecated Preferir conviteUtilizador */
  static convitePortal(params: {
    nomeUtilizador: string;
    entidadeFormadora: string;
    papel: string;
    linkConvite: string;
    expiraEm: string;
  }): EmailTemplate {
    const base = EmailTemplates.conviteUtilizador({
      nomeUtilizador: params.nomeUtilizador,
      entidadeFormadora: params.entidadeFormadora,
      papel: params.papel,
      linkConvite: params.linkConvite,
    });
    return {
      ...base,
      text: base.text.replace("7 dias.", `${params.expiraEm}.`),
      html:
        base.html.replace(
          emailMuted("O link de convite expira em 7 dias."),
          emailMuted(`O link de convite é válido até ${escapeHtml(params.expiraEm)}.`),
        ),
    };
  }

  static sessaoAgendada(params: {
    nomeFormando: string;
    nomeSessao: string;
    dataHora: string;
    localidade: string;
    formador: string;
    portalUrl: string;
  }): EmailTemplate {
    return {
      subject: `Sessão agendada – ${params.nomeSessao}`,
      text:
        `Caro(a) ${params.nomeFormando},\n\n` +
        `Foi inscrito(a) na seguinte sessão de formação:\n\n` +
        `Sessão: ${params.nomeSessao}\n` +
        `Local: ${params.localidade}\n` +
        `Formador: ${params.formador}\n` +
        `Data/hora: ${params.dataHora}\n\n` +
        `Portal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeFormando) +
        emailParagraph("Foi inscrito(a) na seguinte sessão de formação:") +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Sessão", escapeHtml(params.nomeSessao)) +
              emailDataRow("Local", escapeHtml(params.localidade)) +
              emailDataRow("Formador", escapeHtml(params.formador)) +
              emailDataRow("Data/hora", escapeHtml(params.dataHora)),
          ),
        ) +
        emailButtonRow(emailButton("Ver detalhes", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static lmsPrazoLembrete(params: {
    nomeFormando: string;
    acaoTitulo: string;
    limite: string;
    diasRestantes: number;
    pendentes: number;
    portalUrl: string;
  }): EmailTemplate {
    const prazoLabel =
      params.diasRestantes === 1
        ? "O prazo termina amanhã"
        : `Faltam ${params.diasRestantes} dias para o prazo`;
    return {
      subject: `Lembrete LMS – ${params.acaoTitulo}`,
      text:
        `Caro(a) ${params.nomeFormando},\n\n` +
        `${prazoLabel} para concluir os conteúdos LMS de «${params.acaoTitulo}» (até ${params.limite}).\n\n` +
        `Conteúdos por concluir: ${params.pendentes}\n\n` +
        `Continuar: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeFormando) +
        emailParagraph(`${prazoLabel} para concluir os conteúdos LMS de «${escapeHtml(params.acaoTitulo)}».`) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Prazo", escapeHtml(params.limite)) +
              emailDataRow("Por concluir", String(params.pendentes)),
          ),
        ) +
        emailButtonRow(emailButton("Continuar aprendizagem", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static sessaoIniciada(params: {
    nomeDestinatario: string;
    nomeSessao: string;
    acaoTitulo: string;
    dataHora: string;
    formador: string;
    portalUrl: string;
    salaUrl?: string | null;
    emailReuniao?: string | null;
    audiencia: "formando" | "staff";
  }): EmailTemplate {
    const intro =
      params.audiencia === "formando"
        ? "A sessão de formação foi iniciada. Entre agora pelo portal para que a sua presença seja registada."
        : "A sessão de formação foi iniciada.";

    return {
      subject: `Sessão iniciada – ${params.nomeSessao}`,
      text:
        `Caro(a) ${params.nomeDestinatario},\n\n` +
        `${intro}\n\n` +
        `Sessão: ${params.nomeSessao}\n` +
        `Acção: ${params.acaoTitulo}\n` +
        `Formador: ${params.formador}\n` +
        `Horário: ${params.dataHora}\n` +
        (params.audiencia === "formando" && params.emailReuniao
          ? `\nNo Zoom/Teams utilize obrigatoriamente: ${params.emailReuniao}\n`
          : "") +
        (params.salaUrl ? `\nSala online: ${params.salaUrl}\n` : "") +
        `\nPortal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeDestinatario) +
        emailParagraph(intro) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Sessão", escapeHtml(params.nomeSessao)) +
              emailDataRow("Acção", escapeHtml(params.acaoTitulo)) +
              emailDataRow("Formador", escapeHtml(params.formador)) +
              emailDataRow("Horário", escapeHtml(params.dataHora)),
          ),
          "#7c3aed",
        ) +
        (params.audiencia === "formando" && params.emailReuniao
          ? emailInfoBox(
              `<strong>Email na reunião:</strong> <code>${escapeHtml(params.emailReuniao)}</code><br/>` +
                `Utilize este endereço ao entrar no Zoom ou Teams; caso contrário, a assiduidade pode não ser contabilizada.`,
              "#d97706",
            )
          : "") +
        emailButtonRow(
          (params.salaUrl
            ? emailButton("Entrar na sala", params.salaUrl, "success")
            : "") + emailButton("Abrir portal", params.portalUrl, "primary"),
        ) +
        assinatura(),
    };
  }

  static alertaEmailReuniaoIncorreto(params: {
    nomeFormador: string;
    nomeFormando: string;
    nomeSessao: string;
    emailEsperado: string;
    emailParticipante: string;
    portalUrl: string;
  }): EmailTemplate {
    return {
      subject: `Presença – email incorrecto na reunião (${params.nomeFormando})`,
      text:
        `Caro(a) ${params.nomeFormador},\n\n` +
        `O formando ${params.nomeFormando} entrou na sessão «${params.nomeSessao}» com um email que não corresponde ao registado.\n\n` +
        `Email esperado: ${params.emailEsperado}\n` +
        `Email utilizado: ${params.emailParticipante}\n\n` +
        `A assiduidade na reunião não foi contabilizada. Peça ao formando para sair e voltar a entrar com o email correcto.\n\n` +
        `Painel: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeFormador) +
        emailParagraph(
          `O formando <strong>${escapeHtml(params.nomeFormando)}</strong> entrou na sessão ` +
            `<strong>«${escapeHtml(params.nomeSessao)}»</strong> com um email incorrecto.`,
        ) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Email esperado", `<code>${escapeHtml(params.emailEsperado)}</code>`) +
              emailDataRow(
                "Email utilizado",
                `<code>${escapeHtml(params.emailParticipante)}</code>`,
              ),
          ),
          "#dc2626",
        ) +
        emailParagraph(
          "A assiduidade na reunião <strong>não foi contabilizada</strong>. Peça ao formando para sair e voltar a entrar com o email correcto.",
        ) +
        emailButtonRow(emailButton("Ver painel de presenças", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static certificadoDisponivel(params: {
    nomeFormando: string;
    nomeCurso: string;
    codigoFormacao: string;
    portalUrl: string;
    dataExpiracao?: string;
  }): EmailTemplate {
    return {
      subject: `Certificado disponível – ${params.nomeCurso}`,
      text:
        `Caro(a) ${params.nomeFormando},\n\n` +
        `A sua formação foi concluída com sucesso.\n\n` +
        `Formação: ${params.nomeCurso}\n` +
        `Código: ${params.codigoFormacao}\n\n` +
        `O certificado está disponível para descarregar no portal.\n` +
        `${params.portalUrl}\n\n` +
        (params.dataExpiracao ? `Validade até ${params.dataExpiracao}\n\n` : "") +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeFormando) +
        emailParagraph("A sua formação foi concluída com sucesso. O certificado está disponível.") +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Formação", escapeHtml(params.nomeCurso)) +
              emailDataRow("Código", `<code>${escapeHtml(params.codigoFormacao)}</code>`) +
              (params.dataExpiracao
                ? emailDataRow("Validade", escapeHtml(params.dataExpiracao))
                : ""),
          ),
          "#0d9488",
        ) +
        emailButtonRow(emailButton("Descarregar certificado", params.portalUrl, "success")) +
        assinatura(),
    };
  }

  static alertaCompliance(params: {
    entidade: string;
    severidade: "critico" | "aviso";
    mensagem: string;
    detalhes?: string;
    portalUrl: string;
  }): EmailTemplate {
    const isCritico = params.severidade === "critico";
    return {
      subject: `Alerta operacional (${params.severidade}) – ${params.mensagem}`,
      text:
        `Alerta operacional – ${params.entidade}\n\n` +
        `Severidade: ${params.severidade.toUpperCase()}\n` +
        `Mensagem: ${params.mensagem}\n\n` +
        (params.detalhes ? `Detalhes: ${params.detalhes}\n\n` : "") +
        `Portal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        emailHeading(isCritico ? "Alerta crítico" : "Alerta operacional") +
        emailParagraph(`Entidade: <strong>${escapeHtml(params.entidade)}</strong>`) +
        emailInfoBox(
          `<p style="margin:0 0 8px;"><strong>${escapeHtml(params.mensagem)}</strong></p>` +
            (params.detalhes
              ? `<p style="margin:0;font-size:13px;">${escapeHtml(params.detalhes)}</p>`
              : ""),
          isCritico ? "#dc2626" : "#d97706",
        ) +
        emailButtonRow(
          emailButton("Ver detalhes", params.portalUrl, isCritico ? "danger" : "primary"),
        ) +
        assinatura(),
    };
  }

  static resumoInspecao(params: {
    entidade: string;
    totalAcoes: number;
    acoesProntas: number;
    alerta: string[];
    portalUrl: string;
  }): EmailTemplate {
    const percentual =
      params.totalAcoes > 0
        ? Math.round((params.acoesProntas / params.totalAcoes) * 100)
        : 0;

    return {
      subject: `Resumo de inspeção DGERT – ${params.entidade}`,
      text:
        `Resumo de inspeção DGERT\n\n` +
        `Entidade: ${params.entidade}\n` +
        `Acções prontas: ${params.acoesProntas}/${params.totalAcoes} (${percentual}%)\n\n` +
        (params.alerta.length
          ? `Alertas:\n${params.alerta.map((a) => `• ${a}`).join("\n")}\n\n`
          : "") +
        `Portal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        emailHeading("Resumo de inspeção DGERT") +
        emailParagraph(`Entidade: <strong>${escapeHtml(params.entidade)}</strong>`) +
        emailInfoBox(
          `<p style="margin:0;"><strong>Acções prontas:</strong> ` +
            `${params.acoesProntas}/${params.totalAcoes} (${percentual}%)</p>`,
        ) +
        (params.alerta.length
          ? emailParagraph("<strong>Alertas:</strong>") + listaHtml(params.alerta)
          : "") +
        emailButtonRow(emailButton("Abrir portal", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static pedidoAnulacaoFatura(params: {
    gestorNome: string;
    comercialNome: string;
    faturaRef: string;
    motivo: string;
    portalUrl: string;
  }): EmailTemplate {
    return {
      subject: `Pedido de anulação – fatura ${params.faturaRef}`,
      text:
        `Caro(a) ${params.gestorNome},\n\n` +
        `${params.comercialNome} solicitou a anulação da fatura ${params.faturaRef}.\n\n` +
        `Motivo:\n${params.motivo}\n\n` +
        `Rever no portal:\n${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.gestorNome) +
        emailParagraph(
          `<strong>${escapeHtml(params.comercialNome)}</strong> solicitou a ` +
            `<strong>anulação</strong> da fatura <strong>${escapeHtml(params.faturaRef)}</strong>.`,
        ) +
        emailInfoBox(
          `<p style="margin:0 0 8px;"><strong>Motivo</strong></p>` +
            `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(params.motivo)}</p>`,
          "#d97706",
        ) +
        emailButtonRow(emailButton("Rever fatura", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static pedidoAnulacaoRejeitado(params: {
    comercialNome: string;
    faturaRef: string;
    respostaMotivo: string;
    portalUrl: string;
  }): EmailTemplate {
    return {
      subject: `Pedido de anulação rejeitado – ${params.faturaRef}`,
      text:
        `Caro(a) ${params.comercialNome},\n\n` +
        `O pedido de anulação da fatura ${params.faturaRef} foi rejeitado.\n\n` +
        (params.respostaMotivo ? `Motivo:\n${params.respostaMotivo}\n\n` : "") +
        `Portal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.comercialNome) +
        emailParagraph(
          `O pedido de anulação da fatura <strong>${escapeHtml(params.faturaRef)}</strong> foi ` +
            `<strong>rejeitado</strong>.`,
        ) +
        (params.respostaMotivo
          ? emailInfoBox(
              `<p style="margin:0 0 8px;"><strong>Motivo</strong></p>` +
                `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(params.respostaMotivo)}</p>`,
              "#dc2626",
            )
          : "") +
        emailButtonRow(emailButton("Ver fatura", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static websiteSyncFalhou(params: {
    nomeDestinatario: string;
    entidade: string;
    evento: string;
    erro: string;
    portalUrl: string;
  }): EmailTemplate {
    return {
      subject: `Sincronização do website falhou – ${params.entidade}`,
      text:
        `Caro(a) ${params.nomeDestinatario},\n\n` +
        `A sincronização do catálogo de formações com o website falhou (${params.evento}).\n\n` +
        `Erro: ${params.erro}\n\n` +
        `Verifique a configuração no portal:\n${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeDestinatario) +
        emailParagraph(
          `A sincronização do catálogo com o website de ` +
            `<strong>${escapeHtml(params.entidade)}</strong> falhou ` +
            `(evento <code>${escapeHtml(params.evento)}</code>).`,
        ) +
        emailInfoBox(
          `<p style="margin:0 0 8px;"><strong>Erro</strong></p>` +
            `<p style="margin:0;font-family:monospace;font-size:13px;">${escapeHtml(params.erro)}</p>`,
          "#dc2626",
        ) +
        emailButtonRow(emailButton("Abrir formações website", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static propostaEstadoGestor(params: {
    gestorNome: string;
    codigo: string;
    titulo: string;
    cliente: string;
    estado: "ACEITE" | "REJEITADA";
    motivo?: string;
    portalUrl: string;
  }): EmailTemplate {
    const label = params.estado === "ACEITE" ? "aceite" : "rejeitada";
    return {
      subject: `Proposta ${params.codigo} ${label}`,
      text:
        `Caro(a) ${params.gestorNome},\n\n` +
        `A proposta ${params.codigo} («${params.titulo}») foi ${label}.\n` +
        `Cliente: ${params.cliente}\n` +
        (params.motivo ? `Nota do cliente: ${params.motivo}\n` : "") +
        `\nPortal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.gestorNome) +
        emailParagraph(
          `A proposta <strong>${escapeHtml(params.codigo)}</strong> ` +
            `(«${escapeHtml(params.titulo)}») foi <strong>${label}</strong>.`,
        ) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Cliente", escapeHtml(params.cliente)) +
              (params.motivo
                ? emailDataRow(
                    "Nota do cliente",
                    escapeHtml(params.motivo).replace(/\n/g, "<br>"),
                  )
                : ""),
          ),
          params.estado === "ACEITE" ? "#0d9488" : "#dc2626",
        ) +
        emailButtonRow(emailButton("Abrir CRM", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static propostaEstadoComercial(params: {
    comercialNome: string;
    codigo: string;
    titulo: string;
    cliente: string;
    estado: "ACEITE" | "REJEITADA";
    motivo?: string;
    portalUrl: string;
  }): EmailTemplate {
    const label = params.estado === "ACEITE" ? "aceite" : "rejeitada";
    return {
      subject: `A sua proposta ${params.codigo} foi ${label}`,
      text:
        `Caro(a) ${params.comercialNome},\n\n` +
        `A proposta ${params.codigo} («${params.titulo}») que enviou foi ${label}.\n` +
        `Cliente: ${params.cliente}\n` +
        (params.motivo ? `Nota do cliente: ${params.motivo}\n` : "") +
        `\nPortal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.comercialNome) +
        emailParagraph(
          `A proposta <strong>${escapeHtml(params.codigo)}</strong> que enviou foi ` +
            `<strong>${label}</strong>.`,
        ) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Cliente", escapeHtml(params.cliente)) +
              (params.motivo
                ? emailDataRow(
                    "Nota do cliente",
                    escapeHtml(params.motivo).replace(/\n/g, "<br>"),
                  )
                : ""),
          ),
        ) +
        emailButtonRow(emailButton("Abrir CRM", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static propostaEstadoCliente(params: {
    clienteNome: string;
    codigo: string;
    titulo: string;
    entidadeFormadora: string;
    estado: "ACEITE" | "REJEITADA";
    motivo?: string;
  }): EmailTemplate {
    const aceite = params.estado === "ACEITE";
    const label = aceite ? "aceite" : "rejeitada";
    return {
      subject: `Proposta ${params.codigo} ${label} – ${params.entidadeFormadora}`,
      text:
        `Exmo(a). Sr(a). ${params.clienteNome},\n\n` +
        (aceite
          ? `Confirmamos o registo da sua aceitação da proposta ${params.codigo} («${params.titulo}»).\n` +
            `A equipa comercial de ${params.entidadeFormadora} foi notificada e entrará em contacto se necessário.\n\n`
          : `Registámos a sua resposta à proposta ${params.codigo} («${params.titulo}») como rejeitada.\n` +
            (params.motivo ? `Nota: ${params.motivo}\n` : "") +
            `A equipa comercial de ${params.entidadeFormadora} foi notificada.\n\n`) +
        `Com os melhores cumprimentos,\n${params.entidadeFormadora}\n`,
      html:
        emailParagraph(
          `Exmo(a). Sr(a). <strong>${escapeHtml(params.clienteNome)}</strong>,`,
        ) +
        (aceite
          ? emailParagraph(
              `Confirmamos o registo da sua <strong>aceitação</strong> da proposta ` +
                `<strong>${escapeHtml(params.codigo)}</strong> («${escapeHtml(params.titulo)}»).`,
            ) +
            emailParagraph(
              `A equipa comercial de <strong>${escapeHtml(params.entidadeFormadora)}</strong> ` +
                `foi notificada e entrará em contacto se necessário.`,
            )
          : emailParagraph(
              `Registámos a sua resposta à proposta <strong>${escapeHtml(params.codigo)}</strong> ` +
                `(«${escapeHtml(params.titulo)}») como <strong>rejeitada</strong>.`,
            ) +
            (params.motivo
              ? emailParagraph(escapeHtml(params.motivo).replace(/\n/g, "<br>"))
              : "") +
            emailParagraph(
              `A equipa comercial de <strong>${escapeHtml(params.entidadeFormadora)}</strong> foi notificada.`,
            )) +
        assinatura(params.entidadeFormadora),
    };
  }

  static formacaoCatalogoGestor(params: {
    gestorNome: string;
    acao: "atualizada" | "eliminada" | "despublicada";
    titulo: string;
    codigoPublico: number | null;
    portalUrl: string;
  }): EmailTemplate {
    const ref = params.codigoPublico != null ? `#${params.codigoPublico}` : "";
    return {
      subject: `Formação ${ref} ${params.acao} no catálogo`,
      text:
        `Caro(a) ${params.gestorNome},\n\n` +
        `A formação «${params.titulo}» (${ref}) foi ${params.acao} no catálogo do website.\n\n` +
        `${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.gestorNome) +
        emailParagraph(
          `A formação <strong>${escapeHtml(params.titulo)}</strong> (${escapeHtml(ref)}) foi ` +
            `<strong>${params.acao}</strong> no catálogo do website.`,
        ) +
        emailButtonRow(emailButton("Abrir formações website", params.portalUrl, "primary")) +
        assinatura(),
    };
  }

  static tenantLifecycleSuperadmin(params: {
    acao: "criado" | "actualizado" | "arquivado" | "eliminado";
    legalName: string;
    slug: string;
    nif: string;
    status: string;
    actorEmail: string;
    detalhe?: string;
    plataformaUrl: string;
  }): EmailTemplate {
    const titulos: Record<string, string> = {
      criado: "Novo tenant criado",
      actualizado: "Tenant actualizado",
      arquivado: "Tenant arquivado",
      eliminado: "Tenant eliminado permanentemente",
    };
    return {
      subject: `[NexiForma Control Plane] ${titulos[params.acao]} – ${params.slug}`,
      text:
        `${titulos[params.acao]}\n\n` +
        `Entidade: ${params.legalName}\n` +
        `Slug: ${params.slug}\n` +
        `NIF: ${params.nif}\n` +
        `Estado: ${params.status}\n` +
        `Operação por: ${params.actorEmail}\n` +
        (params.detalhe ? `\n${params.detalhe}\n` : "") +
        `\nPlataforma: ${params.plataformaUrl}\n\n` +
        `NexiForma Control Plane\n`,
      html:
        emailHeading(titulos[params.acao] ?? "Operação de tenant") +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Entidade", escapeHtml(params.legalName)) +
              emailDataRow("Slug", `<code>${escapeHtml(params.slug)}</code>`) +
              emailDataRow("NIF", escapeHtml(params.nif)) +
              emailDataRow("Estado", escapeHtml(params.status)) +
              emailDataRow("Operação por", escapeHtml(params.actorEmail)),
          ),
        ) +
        (params.detalhe
          ? emailInfoBox(
              `<pre style="margin:0;white-space:pre-wrap;font-size:12px;">${escapeHtml(params.detalhe)}</pre>`,
              "#64748b",
            )
          : "") +
        emailButtonRow(emailButton("Abrir Control Plane", params.plataformaUrl, "primary")) +
        assinatura("NexiForma Control Plane"),
    };
  }

  static tenantGestorBemVindo(params: {
    nomeGestor: string;
    entidadeFormadora: string;
    slug: string;
    loginUrl: string;
    recuperarUrl: string;
  }): EmailTemplate {
    return {
      subject: `Acesso de gestor – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeGestor},\n\n` +
        `A entidade formadora «${params.entidadeFormadora}» foi registada no NexiForma.\n\n` +
        `Foi criada uma conta de gestor associada a este email.\n` +
        `Identificador (slug): ${params.slug}\n\n` +
        `Iniciar sessão:\n${params.loginUrl}\n\n` +
        `Se não souber a palavra-passe, redefina-a em:\n${params.recuperarUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeGestor) +
        emailParagraph(
          `A entidade formadora <strong>${escapeHtml(params.entidadeFormadora)}</strong> ` +
            `foi registada no NexiForma.`,
        ) +
        emailParagraph(
          "Foi criada uma conta de <strong>gestor</strong> associada a este email. " +
            "Como gestor, pode configurar utilizadores, acções de formação, documentos e integrações.",
        ) +
        emailInfoBox(
          emailDataTable(emailDataRow("Identificador (slug)", `<code>${escapeHtml(params.slug)}</code>`)),
        ) +
        emailButtonRow(emailButton("Iniciar sessão", params.loginUrl, "primary")) +
        emailMuted(
          `Se não souber a palavra-passe, <a href="${params.recuperarUrl.replace(/"/g, "%22")}">redefina-a aqui</a>.`,
        ) +
        assinatura(),
    };
  }

  static tenantGestorConvite(params: {
    nomeGestor: string;
    entidadeFormadora: string;
    slug: string;
    inviteUrl: string;
    loginUrl: string;
  }): EmailTemplate {
    return {
      subject: `Convite de gestor – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeGestor},\n\n` +
        `Foi convidado(a) a gerir a entidade formadora «${params.entidadeFormadora}» no NexiForma.\n\n` +
        `Identificador (slug): ${params.slug}\n` +
        `Guarde este identificador – será necessário no ecrã de login.\n\n` +
        `Activar conta e definir palavra-passe:\n${params.inviteUrl}\n\n` +
        `Após activar, inicie sessão em:\n${params.loginUrl}\n\n` +
        `O link expira em 7 dias.\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeGestor) +
        emailParagraph(
          `Foi convidado(a) a gerir a entidade <strong>${escapeHtml(params.entidadeFormadora)}</strong> ` +
            `no NexiForma, com o cargo de <strong>gestor</strong>.`,
        ) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Identificador (slug)", `<code>${escapeHtml(params.slug)}</code>`),
          ),
        ) +
        emailParagraph(
          "Guarde o identificador da entidade – será necessário no ecrã de login. " +
            "Active a conta para definir a palavra-passe.",
        ) +
        emailButtonRow(emailButton("Activar conta", params.inviteUrl, "primary")) +
        emailMuted(
          `Após activar, <a href="${params.loginUrl.replace(/"/g, "%22")}">inicie sessão</a>. O link de convite expira em 7 dias.`,
        ) +
        assinatura(),
    };
  }

  static tenantGestorCredenciaisTemporarias(params: {
    nomeGestor: string;
    entidadeFormadora: string;
    slug: string;
    email: string;
    temporaryPassword: string;
    loginUrl: string;
  }): EmailTemplate {
    return {
      subject: `Credenciais de acesso de gestor – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeGestor},\n\n` +
        `Foi nomeado(a) gestor da entidade formadora «${params.entidadeFormadora}» no NexiForma.\n\n` +
        `As suas credenciais temporárias de acesso são:\n` +
        `• Identificador (slug): ${params.slug}\n` +
        `• Email: ${params.email}\n` +
        `• Palavra-passe temporária: ${params.temporaryPassword}\n\n` +
        `Aceda ao login:\n${params.loginUrl}\n\n` +
        `No primeiro acesso, ser-lhe-á solicitado que defina a sua palavra-passe definitiva.\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeGestor) +
        emailParagraph(
          `Foi nomeado(a) <strong>gestor</strong> da entidade formadora ` +
            `<strong>${escapeHtml(params.entidadeFormadora)}</strong> no NexiForma.`,
        ) +
        emailParagraph(
          "Foram geradas as seguintes credenciais temporárias para o seu primeiro acesso:",
        ) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Identificador (slug)", `<code>${escapeHtml(params.slug)}</code>`) +
              emailDataRow("Email", `<strong>${escapeHtml(params.email)}</strong>`) +
              emailDataRow(
                "Password temporária",
                `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:bold;color:#0f172a;">${escapeHtml(params.temporaryPassword)}</code>`,
              ),
          ),
        ) +
        emailParagraph(
          "<strong>Importante:</strong> no primeiro login, ser-lhe-á solicitado que introduza uma nova palavra-passe definitiva para a sua conta.",
        ) +
        emailButtonRow(emailButton("Iniciar sessão agora", params.loginUrl, "primary")) +
        emailMuted(
          "Guarde o identificador (slug) da sua entidade. Caso necessite de ajuda, contacte a equipa de suporte.",
        ) +
        assinatura(),
    };
  }

  static formandoCredenciaisTemporarias(params: {
    nomeFormando: string;
    entidadeFormadora: string;
    slug: string;
    email: string;
    temporaryPassword: string;
    loginUrl: string;
  }): EmailTemplate {
    return {
      subject: `Acesso formando – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeFormando},\n\n` +
        `Foi registado(a) como formando na entidade «${params.entidadeFormadora}» no NexiForma.\n\n` +
        `Credenciais temporárias:\n` +
        `• Identificador (slug): ${params.slug}\n` +
        `• Email: ${params.email}\n` +
        `• Palavra-passe temporária: ${params.temporaryPassword}\n\n` +
        `Inicie sessão em:\n${params.loginUrl}\n\n` +
        `No primeiro acesso, defina a sua palavra-passe definitiva.\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeFormando) +
        emailParagraph(
          `Foi registado(a) como <strong>formando</strong> na entidade formadora ` +
            `<strong>${escapeHtml(params.entidadeFormadora)}</strong> no NexiForma.`,
        ) +
        emailParagraph("Utilize as credenciais temporárias abaixo para o primeiro acesso:") +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Identificador (slug)", `<code>${escapeHtml(params.slug)}</code>`) +
              emailDataRow("Email", `<strong>${escapeHtml(params.email)}</strong>`) +
              emailDataRow(
                "Password temporária",
                `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:bold;color:#0f172a;">${escapeHtml(params.temporaryPassword)}</code>`,
              ),
          ),
        ) +
        emailParagraph(
          "<strong>Importante:</strong> no primeiro login, ser-lhe-á pedido que defina uma nova palavra-passe.",
        ) +
        emailButtonRow(emailButton("Iniciar sessão", params.loginUrl, "primary")) +
        assinatura(),
    };
  }

  static formandoContaCriadaStaff(params: {
    nomeStaff: string;
    nomeFormando: string;
    emailFormando: string;
    entidadeFormadora: string;
    slug: string;
    temporaryPassword: string;
    loginUrl: string;
  }): EmailTemplate {
    return EmailTemplates.registoContaCopiaRegistador({
      nomeRegistador: params.nomeStaff,
      tipoPerfil: "formando",
      nomeUtilizador: params.nomeFormando,
      emailUtilizador: params.emailFormando,
      entidadeFormadora: params.entidadeFormadora,
      slug: params.slug,
      temporaryPassword: params.temporaryPassword,
      loginUrl: params.loginUrl,
    });
  }

  static registoContaCopiaRegistador(params: {
    nomeRegistador: string;
    tipoPerfil: "formando" | "formador";
    nomeUtilizador: string;
    emailUtilizador: string;
    entidadeFormadora: string;
    slug: string;
    temporaryPassword: string;
    loginUrl: string;
  }): EmailTemplate {
    const perfilLabel = params.tipoPerfil === "formador" ? "formador" : "formando";
    return {
      subject: `Conta ${perfilLabel} criada – ${params.nomeUtilizador}`,
      text:
        `Caro(a) ${params.nomeRegistador},\n\n` +
        `Confirmamos a criação da conta de ${perfilLabel} para «${params.nomeUtilizador}» (${params.emailUtilizador}), ` +
        `registada por si na plataforma.\n\n` +
        `Credenciais temporárias enviadas ao ${perfilLabel}:\n` +
        `• Slug: ${params.slug}\n` +
        `• Email: ${params.emailUtilizador}\n` +
        `• Palavra-passe temporária: ${params.temporaryPassword}\n\n` +
        `Login: ${params.loginUrl}\n\n` +
        `NexiForma\n`,
      html:
        cumprimento(params.nomeRegistador) +
        emailParagraph(
          `Foi criada a conta de <strong>${perfilLabel}</strong> para ` +
            `<strong>${escapeHtml(params.nomeUtilizador)}</strong> ` +
            `(<a href="mailto:${escapeHtml(params.emailUtilizador)}">${escapeHtml(params.emailUtilizador)}</a>), ` +
            `registada por si.`,
        ) +
        emailParagraph("Credenciais temporárias (cópia para o seu registo):") +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Identificador (slug)", `<code>${escapeHtml(params.slug)}</code>`) +
              emailDataRow(`Email ${perfilLabel}`, `<strong>${escapeHtml(params.emailUtilizador)}</strong>`) +
              emailDataRow(
                "Password temporária",
                `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:bold;color:#0f172a;">${escapeHtml(params.temporaryPassword)}</code>`,
              ),
          ),
        ) +
        emailButtonRow(emailButton("Página de login", params.loginUrl, "secondary")) +
        assinatura(),
    };
  }

  static formadorCredenciaisTemporarias(params: {
    nomeFormador: string;
    entidadeFormadora: string;
    slug: string;
    email: string;
    temporaryPassword: string;
    loginUrl: string;
    portalUrl: string;
    documentosObrigatorios: string[];
  }): EmailTemplate {
    const docs = params.documentosObrigatorios;
    return {
      subject: `Acesso formador – ${params.entidadeFormadora}`,
      text:
        `Caro(a) ${params.nomeFormador},\n\n` +
        `Foi registado(a) como formador na entidade «${params.entidadeFormadora}» no NexiForma.\n\n` +
        `Credenciais temporárias:\n` +
        `• Identificador (slug): ${params.slug}\n` +
        `• Email: ${params.email}\n` +
        `• Palavra-passe temporária: ${params.temporaryPassword}\n\n` +
        `Inicie sessão em:\n${params.loginUrl}\n\n` +
        `Documentos obrigatórios a carregar no perfil:\n` +
        docs.map((d) => `• ${d}`).join("\n") +
        `\n\nPortal: ${params.portalUrl}\n\n` +
        `No primeiro acesso, defina a sua palavra-passe definitiva.\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nomeFormador) +
        emailParagraph(
          `Foi registado(a) como <strong>formador</strong> na entidade formadora ` +
            `<strong>${escapeHtml(params.entidadeFormadora)}</strong> no NexiForma.`,
        ) +
        emailParagraph("Utilize as credenciais temporárias abaixo para o primeiro acesso:") +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Identificador (slug)", `<code>${escapeHtml(params.slug)}</code>`) +
              emailDataRow("Email", `<strong>${escapeHtml(params.email)}</strong>`) +
              emailDataRow(
                "Password temporária",
                `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:bold;color:#0f172a;">${escapeHtml(params.temporaryPassword)}</code>`,
              ),
          ),
        ) +
        emailParagraph("Documentos obrigatórios a carregar após o login:") +
        emailInfoBox(
          `<p style="margin:0 0 8px;"><strong>Checklist documental</strong></p>` +
            listaHtml(docs.length ? docs : ["Curriculum Vitae", "Documento de identificação", "CCP"]),
          "#d97706",
        ) +
        emailParagraph(
          "<strong>Importante:</strong> no primeiro login, ser-lhe-á pedido que defina uma nova palavra-passe.",
        ) +
        emailButtonRow(emailButton("Iniciar sessão", params.loginUrl, "primary")) +
        emailMuted(`<a href="${params.portalUrl.replace(/"/g, "%22")}">Abrir perfil de formador</a> para carregar documentos.`) +
        assinatura(),
    };
  }

  static erroPlataforma(params: {
    modulo: string;
    tenantLabel: string;
    resumo: string;
    detalhe?: string;
    htmlDetalhe?: string;
    statusCode?: number;
  }): EmailTemplate {
    const httpLabel = params.statusCode ? `HTTP ${params.statusCode}` : "Erro";
    return {
      subject: `[NexiForma] ${httpLabel} – ${params.modulo}`,
      text:
        `Erro na plataforma NexiForma\n\n` +
        `Módulo: ${params.modulo}\n` +
        `Tenant: ${params.tenantLabel}\n` +
        `Resumo: ${params.resumo}\n\n` +
        (params.detalhe ? `${params.detalhe}\n\n` : "") +
        `NexiForma Control Plane\n`,
      html:
        params.htmlDetalhe ??
        emailHeading("Erro na plataforma") +
          emailInfoBox(
            emailDataTable(
              emailDataRow("Módulo", escapeHtml(params.modulo)) +
                emailDataRow("Tenant", escapeHtml(params.tenantLabel)) +
                emailDataRow("Resumo", escapeHtml(params.resumo)),
            ),
            "#dc2626",
          ) +
          (params.detalhe
            ? emailInfoBox(
                `<pre style="margin:0;white-space:pre-wrap;font-size:12px;">${escapeHtml(params.detalhe)}</pre>`,
              )
            : "") +
          assinatura("NexiForma Control Plane"),
    };
  }

  static lembreteCalendario(params: {
    nome: string;
    titulo: string;
    corpo: string;
    tipo: string;
    link: string;
    teamsJoinUrl?: string;
  }): EmailTemplate {
    const labels: Record<string, string> = {
      CRIACAO: "Novo evento no calendário",
      SEMANA_ANTES: "Lembrete – evento em 1 semana",
      DIA_ANTES: "Lembrete – evento amanhã",
      HORA_EVENTO: "Lembrete – evento em 1 hora",
      TEAMS_SALA: "Sala Microsoft Teams disponível",
    };
    const label = labels[params.tipo] ?? "Lembrete de calendário";
    return {
      subject: `${label}: ${params.titulo}`,
      text:
        `Caro(a) ${params.nome},\n\n` +
        `${label}\n\n` +
        `${params.titulo}\n` +
        `${params.corpo}\n` +
        (params.teamsJoinUrl ? `\nSala Teams: ${params.teamsJoinUrl}\n` : "") +
        `\nCalendário: ${params.link}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        cumprimento(params.nome) +
        emailParagraph(`<strong>${escapeHtml(label)}</strong>`) +
        emailInfoBox(
          `<p style="margin:0 0 8px;"><strong>${escapeHtml(params.titulo)}</strong></p>` +
            `<p style="margin:0;">${escapeHtml(params.corpo)}</p>`,
        ) +
        emailButtonRow(
          (params.teamsJoinUrl
            ? emailButton("Entrar na sala Teams", params.teamsJoinUrl, "secondary")
            : "") + emailButton("Abrir calendário", params.link, "primary"),
        ) +
        assinatura(),
    };
  }

  static propostaComercialCliente(params: {
    titulo: string;
    codigo: string;
    entidadeFormadora: string;
    clienteNome: string;
    valorLabel: string;
    validadeLabel: string | null;
    descricao: string | null;
    pdfFilename: string;
    aceitarUrl: string;
    rejeitarUrl: string;
  }): EmailTemplate {
    const descricaoHtml = params.descricao
      ? emailParagraph(escapeHtml(params.descricao).replace(/\n/g, "<br>"))
      : "";
    const validadeTexto = params.validadeLabel ? `\nValidade: ${params.validadeLabel}` : "";

    return {
      subject: `Proposta comercial ${params.codigo} – ${params.entidadeFormadora}`,
      text:
        `Exmo(a). Sr(a). ${params.clienteNome},\n\n` +
        `${params.entidadeFormadora} envia-lhe uma proposta comercial.\n\n` +
        `Proposta: ${params.titulo}\n` +
        `Código: ${params.codigo}\n` +
        `Valor: ${params.valorLabel}${validadeTexto}\n\n` +
        (params.descricao ? `${params.descricao}\n\n` : "") +
        `Em anexo: documento em PDF (${params.pdfFilename}).\n\n` +
        `Para aceitar:\n${params.aceitarUrl}\n\n` +
        `Para recusar:\n${params.rejeitarUrl}\n\n` +
        `Com os melhores cumprimentos,\n${params.entidadeFormadora}\n`,
      html:
        emailParagraph(
          `Exmo(a). Sr(a). <strong>${escapeHtml(params.clienteNome)}</strong>,`,
        ) +
        emailParagraph(
          `<strong>${escapeHtml(params.entidadeFormadora)}</strong> envia-lhe uma proposta comercial. ` +
            `Consulte o resumo abaixo e o documento em PDF em anexo.`,
        ) +
        emailInfoBox(
          emailDataTable(
            emailDataRow("Proposta", escapeHtml(params.titulo)) +
              emailDataRow("Código", escapeHtml(params.codigo)) +
              emailDataRow("Valor", escapeHtml(params.valorLabel)) +
              (params.validadeLabel
                ? emailDataRow("Validade", escapeHtml(params.validadeLabel))
                : "") +
              emailDataRow("Entidade", escapeHtml(params.entidadeFormadora)),
          ),
          "#0d9488",
        ) +
        descricaoHtml +
        emailParagraph(
          `O documento completo segue em anexo (<strong>${escapeHtml(params.pdfFilename)}</strong>).`,
        ) +
        emailParagraph("Pode responder a este email ou utilizar os botões abaixo:") +
        emailButtonRow(
          emailButton("Aceitar proposta", params.aceitarUrl, "success") +
            emailButton("Recusar proposta", params.rejeitarUrl, "secondary"),
        ) +
        emailMuted(
          "Se os botões não funcionarem no seu cliente de email, copie os links da versão em texto desta mensagem.",
        ) +
        assinatura(params.entidadeFormadora),
    };
  }

  /**
   * Formador terminou sessão sem validar folha e/ou assinar sumário -
   * aviso ao departamento pedagógico.
   */
  static sessaoTerminadaComPendencias(params: {
    nomeDestinatario: string;
    entidade: string;
    formadorNome: string;
    acaoLabel: string;
    sessaoLabel: string;
    pendencias: string[];
    portalUrl: string;
  }): EmailTemplate {
    const listaTxt = params.pendencias.map((p) => `• ${p}`).join("\n");
    return {
      subject: `Pendências após sessão – ${params.acaoLabel}`,
      text:
        `Caro(a) ${params.nomeDestinatario},\n\n` +
        `O formador ${params.formadorNome} terminou a sessão «${params.sessaoLabel}» ` +
        `da acção «${params.acaoLabel}» com documentação pedagógica por concluir:\n\n` +
        `${listaTxt}\n\n` +
        `É necessária validação/aprovação no portal:\n${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\n${params.entidade}\n`,
      html:
        cumprimento(params.nomeDestinatario) +
        emailParagraph(
          `O formador <strong>${escapeHtml(params.formadorNome)}</strong> terminou a sessão ` +
            `<strong>«${escapeHtml(params.sessaoLabel)}»</strong> da acção ` +
            `<strong>«${escapeHtml(params.acaoLabel)}»</strong> com documentação pedagógica por concluir:`,
        ) +
        listaHtml(params.pendencias) +
        emailInfoBox(
          "Enquanto a folha e/ou o sumário não estiverem validados e aprovados, " +
            "a acção pode ficar incompleta para efeitos de dossiê pedagógico / DGERT.",
          "#d97706",
        ) +
        emailButtonRow(emailButton("Abrir acção no portal", params.portalUrl, "primary")) +
        assinatura(params.entidade),
    };
  }

  /**
   * Formador saiu do portal (logout) com folha/sumário por validar -
   * aviso ao departamento pedagógico.
   */
  static formadorLogoutComPendencias(params: {
    nomeDestinatario: string;
    entidade: string;
    formadorNome: string;
    linhas: string[];
    portalUrl: string;
  }): EmailTemplate {
    const n = params.linhas.length;
    return {
      subject: `Pendências pedagógicas – ${params.formadorNome} saiu do portal`,
      text:
        `Caro(a) ${params.nomeDestinatario},\n\n` +
        `O formador ${params.formadorNome} saiu do portal com ${n} sessão(ões) ` +
        `com documentação pedagógica por concluir:\n\n` +
        params.linhas.map((l) => `• ${l}`).join("\n") +
        `\n\nPortal:\n${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\n${params.entidade}\n`,
      html:
        cumprimento(params.nomeDestinatario) +
        emailParagraph(
          `O formador <strong>${escapeHtml(params.formadorNome)}</strong> saiu do portal ` +
            `com <strong>${n}</strong> sessão(ões) com documentação pedagógica por concluir:`,
        ) +
        listaHtml(params.linhas) +
        emailInfoBox(
          "É necessária validação da folha de presenças e/ou assinatura do sumário " +
            "para o dossiê pedagógico ficar completo.",
          "#d97706",
        ) +
        emailButtonRow(emailButton("Abrir portal", params.portalUrl, "primary")) +
        assinatura(params.entidade),
    };
  }

  /** Logout com documentos universais / do cargo em falta. */
  static logoutDocumentosObrigatoriosEmFalta(params: {
    nomeDestinatario: string;
    entidade: string;
    utilizadorNome: string;
    roleLabel: string;
    linhas: string[];
    portalUrl: string;
    paraUtilizador: boolean;
  }): EmailTemplate {
    const n = params.linhas.length;
    const subject = params.paraUtilizador
      ? `Lembrete – documentos obrigatórios em falta`
      : `Documentos em falta – ${params.utilizadorNome} saiu do portal`;

    const intro = params.paraUtilizador
      ? `Saiu do portal com <strong>${n}</strong> documento(s) obrigatório(s) por enviar:`
      : `O ${params.roleLabel.toLowerCase()} <strong>${escapeHtml(params.utilizadorNome)}</strong> saiu do portal ` +
        `com <strong>${n}</strong> documento(s) obrigatório(s) em falta:`;

    const info = params.paraUtilizador
      ? "Envie os documentos em falta assim que possível para concluir o registo na entidade formadora."
      : "É necessário que o utilizador envie os documentos em falta para cumprir os requisitos da entidade formadora.";

    return {
      subject,
      text:
        `Caro(a) ${params.nomeDestinatario},\n\n` +
        (params.paraUtilizador
          ? `Saiu do portal com ${n} documento(s) obrigatório(s) por enviar:\n\n`
          : `O ${params.roleLabel.toLowerCase()} ${params.utilizadorNome} saiu do portal com ${n} documento(s) em falta:\n\n`) +
        params.linhas.map((l) => `• ${l}`).join("\n") +
        `\n\nPortal:\n${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\n${params.entidade}\n`,
      html:
        cumprimento(params.nomeDestinatario) +
        emailParagraph(intro) +
        listaHtml(params.linhas) +
        emailInfoBox(info, "#d97706") +
        emailButtonRow(emailButton("Abrir documentos no portal", params.portalUrl, "primary")) +
        assinatura(params.entidade),
    };
  }

  /** Digest de alertas para gestores / formadores. */
  static digestAlertas(params: {
    entidade: string;
    linhas: string[];
    portalUrl: string;
  }): EmailTemplate {
    const n = params.linhas.length;
    return {
      subject: `NexiForma – ${n} alerta(s) operacional(is)`,
      text:
        `Resumo de alertas – ${params.entidade}\n\n` +
        (n === 0
          ? "Sem alertas activos neste momento.\n"
          : params.linhas.map((l) => `• ${l}`).join("\n") + "\n") +
        `\nPortal: ${params.portalUrl}\n\n` +
        `Com os melhores cumprimentos,\nNexiForma\n`,
      html:
        emailHeading("Resumo de alertas operacionais") +
        emailParagraph(`Entidade: <strong>${escapeHtml(params.entidade)}</strong>`) +
        (n === 0
          ? emailParagraph("Sem alertas activos neste momento.")
          : listaHtml(params.linhas)) +
        emailButtonRow(emailButton("Abrir portal", params.portalUrl, "primary")) +
        assinatura(),
    };
  }
}
