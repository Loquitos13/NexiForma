/**
 * SMS Templates – NexiForma Fase 8
 * Mensagens curtas para confirmação e lembretes
 */

export class SmsTemplates {
  /**
   * Confirmação de sessão
   */
  static confirmacaoSessao(params: {
    nomeSessao: string;
    data: string;
    hora: string;
  }): string {
    return (
      `NexiForma: Confirmamos a tua inscrição em «${params.nomeSessao}» ` +
      `para ${params.data} às ${params.hora}. ` +
      `Consulta o portal para mais detalhes.`
    );
  }

  /**
   * Lembrete de sessão (24h antes)
   */
  static lembreteSessao(params: {
    nomeSessao: string;
    data: string;
    hora: string;
    portal: string;
  }): string {
    return (
      `NexiForma: Recordamos que amanhã (${params.data}, ${params.hora}) ` +
      `tens «${params.nomeSessao}». ` +
      `${params.portal}`
    );
  }

  /**
   * Notificação de certificado disponível
   */
  static certificadoDisponivel(params: {
    nomeCurso: string;
    portal: string;
  }): string {
    return (
      `NexiForma: O teu certificado de «${params.nomeCurso}» ` +
      `está pronto! Descarrega em ${params.portal}`
    );
  }

  /**
   * Código OTP para MFA
   */
  static otp(params: { codigo: string }): string {
    return (
      `NexiForma: Código de autenticação: ${params.codigo}. ` +
      `Validade: 5 minutos.`
    );
  }

  /**
   * Alerta crítico de compliance
   */
  static alertaCritico(params: {
    entidade: string;
    mensagem: string;
  }): string {
    return (
      `🔴 CRÍTICO – NexiForma: ${params.mensagem} em ${params.entidade}. ` +
      `Actua já no portal.`
    );
  }
}
