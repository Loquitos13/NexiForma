export const RGPD_TERMS_VERSION = "2026-05-v1";

export type ConsentAdminStatus = "PENDING" | "APPROVED" | "REJECTED";

export function buildRgpdConsentText(tenantLegalName: string): string {
  return `Informação sobre tratamento de dados pessoais

A plataforma NexiForma é apenas o meio técnico de acesso. Os teus dados pessoais **não são utilizados pela NexiForma** para fins próprios de marketing ou perfilagem.

Os dados que facultas (documentos de identificação, dados de formação e contacto) são tratados **exclusivamente pela entidade formadora ${tenantLegalName}**, no âmbito da ação de formação em que estás inscrito ou a que te vais candidatar - por exemplo: matrícula, assiduidade, certificação, cumprimento de requisitos DGERT e comunicações relacionadas com a formação.

A NexiForma atua como **subcontratante / encarregado do tratamento** por conta dessa entidade, limitando-se a alojar e transmitir a informação conforme instruções da entidade.

Tens direito de acesso, retificação, oposição e eliminação nos termos do RGPD, contactando a entidade formadora ou exercendo os teus direitos através das ferramentas disponíveis neste portal.

Versão do aviso: ${RGPD_TERMS_VERSION}`;
}

export function consentRequiresDecision(
  userAccepted: boolean | null | undefined,
  storedVersion: string | null | undefined,
): boolean {
  if (userAccepted === null || userAccepted === undefined) return true;
  if (!storedVersion || storedVersion !== RGPD_TERMS_VERSION) return true;
  return false;
}
