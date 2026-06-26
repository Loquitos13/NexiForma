/**
 * Email Templates – NexiForma Fase 8
 * Notificações para formandos, formadores e coordenadores
 */

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export class EmailTemplates {
  /**
   * Notificação de sessão agendada
   */
  static sessaoAgendada(params: {
    nomeFormando: string;
    nomeSessao: string;
    dataHora: string;
    localidade: string;
    formador: string;
    portalUrl: string;
  }): EmailTemplate {
    return {
      subject: `📅 Sessão agendada: ${params.nomeSessao} – ${params.dataHora}`,
      text:
        `Olá ${params.nomeFormando},\n\n` +
        `Foste inscrito(a) na sessão de formação:\n\n` +
        `🎯 ${params.nomeSessao}\n` +
        `📍 ${params.localidade}\n` +
        `👨‍🏫 Formador: ${params.formador}\n` +
        `⏰ Data/Hora: ${params.dataHora}\n\n` +
        `Consulta os detalhes no portal: ${params.portalUrl}\n\n` +
        `–\n` +
        `NexiForma\n`,
      html:
        `<p>Olá <strong>${params.nomeFormando}</strong>,</p>` +
        `<p>Foste inscrito(a) na sessão de formação:</p>` +
        `<div style="background: #f5f5f5; padding: 12px; border-left: 4px solid #0066cc; margin: 16px 0;">` +
        `<p><strong>${params.nomeSessao}</strong></p>` +
        `<p>📍 <strong>${params.localidade}</strong></p>` +
        `<p>👨‍🏫 <strong>Formador:</strong> ${params.formador}</p>` +
        `<p>⏰ <strong>Data/Hora:</strong> ${params.dataHora}</p>` +
        `</div>` +
        `<p><a href="${params.portalUrl}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Ver detalhes</a></p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }

  /**
   * Sessão de formação iniciada (formandos, formador, gestores)
   */
  static sessaoIniciada(params: {
    nomeDestinatario: string;
    nomeSessao: string;
    acaoTitulo: string;
    dataHora: string;
    formador: string;
    portalUrl: string;
    salaUrl?: string | null;
    /** Email a usar no Zoom/Teams (formandos). */
    emailReuniao?: string | null;
    /** formando = convite a entrar; staff = aviso de início */
    audiencia: "formando" | "staff";
  }): EmailTemplate {
    const intro =
      params.audiencia === "formando"
        ? "A sessão de formação começou. Entra agora pelo portal para a tua presença ser registada."
        : "A sessão de formação foi iniciada.";

    const salaBlock = params.salaUrl
      ? `\n🔗 Sala online: ${params.salaUrl}\n`
      : "";

    const emailReuniaoBlock =
      params.audiencia === "formando" && params.emailReuniao
        ? `\n📧 No Zoom/Teams usa obrigatoriamente: ${params.emailReuniao}\n`
        : "";

    const salaHtml = params.salaUrl
      ? `<p><a href="${params.salaUrl}" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Entrar na sala</a></p>`
      : "";

    const emailReuniaoHtml =
      params.audiencia === "formando" && params.emailReuniao
        ? `<p style="background:#fef3c7;padding:10px;border-radius:6px;color:#92400e;">` +
          `<strong>Email na reunião:</strong> <code>${params.emailReuniao}</code><br/>` +
          `Usa este endereço ao entrar no Zoom ou Teams - caso contrário a assiduidade pode não contar.</p>`
        : "";

    return {
      subject: `▶ Sessão iniciada: ${params.nomeSessao}`,
      text:
        `Olá ${params.nomeDestinatario},\n\n` +
        `${intro}\n\n` +
        `🎯 ${params.nomeSessao}\n` +
        `📚 ${params.acaoTitulo}\n` +
        `👨‍🏫 Formador: ${params.formador}\n` +
        `⏰ ${params.dataHora}\n` +
        emailReuniaoBlock +
        salaBlock +
        `\nPortal: ${params.portalUrl}\n\n` +
        `–\nNexiForma\n`,
      html:
        `<p>Olá <strong>${params.nomeDestinatario}</strong>,</p>` +
        `<p>${intro}</p>` +
        `<div style="background: #f5f5f5; padding: 12px; border-left: 4px solid #7c3aed; margin: 16px 0;">` +
        `<p><strong>${params.nomeSessao}</strong></p>` +
        `<p>📚 ${params.acaoTitulo}</p>` +
        `<p>👨‍🏫 <strong>Formador:</strong> ${params.formador}</p>` +
        `<p>⏰ <strong>${params.dataHora}</strong></p>` +
        `</div>` +
        emailReuniaoHtml +
        salaHtml +
        `<p><a href="${params.portalUrl}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Abrir portal</a></p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }

  /** Alerta ao formador: formando entrou na reunião com email incorrecto. */
  static alertaEmailReuniaoIncorreto(params: {
    nomeFormador: string;
    nomeFormando: string;
    nomeSessao: string;
    emailEsperado: string;
    emailParticipante: string;
    portalUrl: string;
  }): EmailTemplate {
    return {
      subject: `⚠ Presença: email incorrecto na reunião (${params.nomeFormando})`,
      text:
        `Olá ${params.nomeFormador},\n\n` +
        `O formando ${params.nomeFormando} entrou na ${params.nomeSessao} com um email que não corresponde ao registado.\n\n` +
        `Email esperado: ${params.emailEsperado}\n` +
        `Email usado: ${params.emailParticipante}\n\n` +
        `A assiduidade na reunião não foi contada. Pede ao formando para sair e voltar a entrar com o email correcto.\n\n` +
        `Painel: ${params.portalUrl}\n\n` +
        `–\nNexiForma\n`,
      html:
        `<p>Olá <strong>${params.nomeFormador}</strong>,</p>` +
        `<p>O formando <strong>${params.nomeFormando}</strong> entrou na <strong>${params.nomeSessao}</strong> com email incorrecto.</p>` +
        `<ul>` +
        `<li>Esperado: <code>${params.emailEsperado}</code></li>` +
        `<li>Usado: <code>${params.emailParticipante}</code></li>` +
        `</ul>` +
        `<p>A assiduidade na reunião <strong>não foi contada</strong>.</p>` +
        `<p><a href="${params.portalUrl}">Ver painel de presenças</a></p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }

  /**
   * Notificação de certificado disponível
   */
  static certificadoDisponivel(params: {
    nomeFormando: string;
    nomeCurso: string;
    codigoFormacao: string;
    portalUrl: string;
    dataExpiracao?: string;
  }): EmailTemplate {
    return {
      subject: `🎓 Certificado de formação disponível – ${params.nomeCurso}`,
      text:
        `Olá ${params.nomeFormando},\n\n` +
        `A tua formação foi concluída com sucesso!\n\n` +
        `📜 ${params.nomeCurso}\n` +
        `Código: ${params.codigoFormacao}\n\n` +
        `O teu certificado está disponível para descarregar no portal.\n\n` +
        `🔗 ${params.portalUrl}\n\n` +
        (params.dataExpiracao
          ? `Validade até ${params.dataExpiracao}\n\n`
          : "") +
        `–\n` +
        `NexiForma\n`,
      html:
        `<p>Olá <strong>${params.nomeFormando}</strong>,</p>` +
        `<p>A tua formação foi concluída com sucesso! 🎉</p>` +
        `<div style="background: #f5f5f5; padding: 12px; border-left: 4px solid #28a745; margin: 16px 0;">` +
        `<p><strong>${params.nomeCurso}</strong></p>` +
        `<p>Código: <code>${params.codigoFormacao}</code></p>` +
        (params.dataExpiracao
          ? `<p>Validade até: <strong>${params.dataExpiracao}</strong></p>`
          : "") +
        `</div>` +
        `<p><a href="${params.portalUrl}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Descarregar certificado</a></p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }

  /**
   * Convite de acesso ao portal
   */
  static convitePortal(params: {
    nomeUtilizador: string;
    entidadeFormadora: string;
    papel: string;
    linkConvite: string;
    expiraEm: string;
  }): EmailTemplate {
    return {
      subject: `Convite: Acesso ao NexiForma – ${params.entidadeFormadora}`,
      text:
        `Olá ${params.nomeUtilizador},\n\n` +
        `Foste convidado(a) para aceder ao NexiForma!\n\n` +
        `Entidade: ${params.entidadeFormadora}\n` +
        `Papel: ${params.papel}\n\n` +
        `Link de convite (válido até ${params.expiraEm}):\n` +
        `${params.linkConvite}\n\n` +
        `Se tiveres dúvidas, contacta o administrador.\n\n` +
        `–\n` +
        `NexiForma\n`,
      html:
        `<p>Olá <strong>${params.nomeUtilizador}</strong>,</p>` +
        `<p>Foste convidado(a) para aceder ao NexiForma!</p>` +
        `<div style="background: #f5f5f5; padding: 12px; border-left: 4px solid #0066cc; margin: 16px 0;">` +
        `<p><strong>${params.entidadeFormadora}</strong></p>` +
        `<p>Papel: <em>${params.papel}</em></p>` +
        `</div>` +
        `<p><a href="${params.linkConvite}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Aceitar convite</a></p>` +
        `<p style="font-size: 12px; color: #666;">Link válido até ${params.expiraEm}</p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }

  /**
   * Alerta de compliance DGERT
   */
  static alertaCompliance(params: {
    entidade: string;
    severidade: "critico" | "aviso";
    mensagem: string;
    detalhes?: string;
    portalUrl: string;
  }): EmailTemplate {
    const isCritico = params.severidade === "critico";
    const icone = isCritico ? "🔴" : "🟡";
    const cor = isCritico ? "#dc3545" : "#ffc107";

    return {
      subject: `${icone} Alerta operacional: ${params.mensagem}`,
      text:
        `ALERTA OPERACIONAL – ${params.entidade}\n\n` +
        `Severidade: ${params.severidade.toUpperCase()}\n` +
        `Mensagem: ${params.mensagem}\n\n` +
        (params.detalhes ? `Detalhes: ${params.detalhes}\n\n` : "") +
        `Consulta o portal: ${params.portalUrl}\n\n` +
        `–\n` +
        `NexiForma\n`,
      html:
        `<div style="background: ${cor}; color: white; padding: 12px; border-radius: 4px; margin: 16px 0;">` +
        `<p style="margin: 0;"><strong>${icone} ALERTA – ${params.severidade.toUpperCase()}</strong></p>` +
        `<p style="margin: 8px 0;"><strong>${params.mensagem}</strong></p>` +
        (params.detalhes
          ? `<p style="margin: 8px 0; font-size: 12px;">${params.detalhes}</p>`
          : "") +
        `</div>` +
        `<p><a href="${params.portalUrl}" style="background: ${cor}; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Ver detalhes</a></p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }

  /**
   * Resumo de inspeção DGERT
   */
  static resumoInspecao(params: {
    entidade: string;
    totalAcoes: number;
    acoesProntas: number;
    alerta: string[];
    portalUrl: string;
  }): EmailTemplate {
    const percentual = Math.round(
      (params.acoesProntas / params.totalAcoes) * 100,
    );

    return {
      subject: `📋 Resumo de inspeção DGERT – ${params.entidade}`,
      text:
        `Resumo de Inspeção DGERT\n\n` +
        `Entidade: ${params.entidade}\n` +
        `Acções prontas: ${params.acoesProntas}/${params.totalAcoes} (${percentual}%)\n\n` +
        (params.alerta.length > 0
          ? `Alertas:\n${params.alerta.map((a) => `• ${a}`).join("\n")}\n\n`
          : "") +
        `Consulta o portal para mais detalhes: ${params.portalUrl}\n\n` +
        `–\n` +
        `NexiForma\n`,
      html:
        `<h2>📋 Resumo de Inspeção DGERT</h2>` +
        `<p><strong>Entidade:</strong> ${params.entidade}</p>` +
        `<div style="background: #f5f5f5; padding: 12px; border-left: 4px solid #0066cc; margin: 16px 0;">` +
        `<p><strong>Acções prontas:</strong> ${params.acoesProntas}/${params.totalAcoes} (${percentual}%)</p>` +
        `<div style="background: white; height: 20px; border-radius: 4px; overflow: hidden;">` +
        `<div style="background: #0066cc; height: 100%; width: ${percentual}%; transition: width 0.3s;"></div>` +
        `</div>` +
        `</div>` +
        (params.alerta.length > 0
          ? `<p><strong>Alertas:</strong></p><ul>${params.alerta.map((a) => `<li>${a}</li>`).join("")}</ul>`
          : "") +
        `<p><a href="${params.portalUrl}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Ver detalhes</a></p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }

  /** Pedido de anulação de fatura (comercial → gestor) */
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
        `Olá ${params.gestorNome},\n\n` +
        `${params.comercialNome} solicitou a anulação da fatura ${params.faturaRef}.\n\n` +
        `Motivo:\n${params.motivo}\n\n` +
        `Rever no portal: ${params.portalUrl}\n\n` +
        `–\nNexiForma\n`,
      html:
        `<p>Olá <strong>${params.gestorNome}</strong>,</p>` +
        `<p><strong>${params.comercialNome}</strong> solicitou a <strong>anulação</strong> da fatura ` +
        `<strong>${params.faturaRef}</strong>.</p>` +
        `<div style="background:#fef3c7;padding:12px;border-left:4px solid #d97706;margin:16px 0;">` +
        `<p style="margin:0;"><strong>Motivo:</strong></p>` +
        `<p style="margin:8px 0 0;white-space:pre-wrap;">${params.motivo}</p>` +
        `</div>` +
        `<p><a href="${params.portalUrl}" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;">Rever fatura</a></p>` +
        `<p>–<br>NexiForma</p>`,
    };
  }
}
