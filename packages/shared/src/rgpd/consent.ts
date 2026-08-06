export const RGPD_TERMS_VERSION = "2026-08-v1";

export type ConsentAdminStatus = "PENDING" | "APPROVED" | "REJECTED";

export function buildRgpdConsentText(_tenantLegalName: string): string {
  return `A NexiForma by FormaFuturo está empenhada em proteger os seus dados pessoais e respeitar a sua privacidade. A NexiForma by FormaFuturo recolhe e trata dados pessoais ao abrigo do Regulamento (UE) 2016/679 do Parlamento Europeu relativo à proteção das pessoas singulares no que diz respeito ao tratamento de dados.

Este diploma entrou na nossa ordem jurídica em 25 de maio de 2018 e pretende responder aos desafios colocados pela revolução tecnológica ocorrida nas últimas décadas e proteger melhor os dados sobre as pessoas, os direitos dos cidadãos da UE e a livre circulação de dados. Atualmente três documentos legais (RGPD, Lei n.º 58/2018 e Lei n.º 59/2019) constituem a nova legislação de proteção de dados pessoais em Portugal.

Porquê e como tratamos os seus dados pessoais?
A FormaFuturo trata os seus dados pessoais com as seguintes finalidades:
• Gestão das inscrições e participação em cursos
• Gestão de clientes
• Marketing
• Recrutamento

A minha informação é partilhada com outros?
Caso o seu curso seja homologado ou certificado sectorialmente por uma outra entidade, a sua informação apenas é partilhada com as entidades reguladoras dos cursos que frequenta. Trabalhamos com cursos da DGERT (Direção Geral do Emprego e das Relações de Trabalho) e IEFP (Instituto de Emprego e Formação Profissional).
Os seus dados são também registados na plataforma nacional de Formação SIGO para emissão dos certificados de acordo com a Portaria 474/2010.
Os dados para faturação são lançados no sistema NexiForma (Nome, NIF, morada, Código Postal e email). Para além destes registos, não há qualquer partilha de dados pessoais com o exterior.

Que dados são solicitados para participar num curso?
Os dados solicitados para inscrição são: nome completo, situação face ao emprego, habilitações, data de nascimento, nº de telemóvel, email, morada, nacionalidade, naturalidade (Distrito e Concelho), nº de documento de identificação, nº de contribuinte, validade do documento de identificação, entidade empregadora e função. Estes dados são fundamentais para a emissão do certificado através da plataforma SIGO.
A NexiForma by FormaFuturo não faz qualquer partilha da informação gravada, sendo estas registadas com as devidas precauções nos nossos dispositivos de armazenamento.

Necessitam da minha morada?
Não. É um campo livre. Pode ser preenchida se quiser usufruir do serviço de envio via CTT. A NexiForma by FormaFuturo não faz qualquer visita física nem envia correspondência para a morada facultada, a não ser o envio do certificado no caso de optar por esse serviço extra.

Necessitam do meu contacto telefónico?
Não é obrigatório. Se preencher o formulário de ficha de inscrição online e não quiser ceder o contacto, pode deixar o campo vazio. Sem nº de telemóvel, comunicaremos apenas por email - deve estar atento à caixa de SPAM.

Como recolhem os meus dados pessoais?
• Através do nosso site, preenchendo formulários
• Através da área pessoal em nexiforma.pt/portal/…/perfil
• Através de email
• Por contacto telefónico
• Presencialmente

Em que situações entram em contacto telefónico?
Quando o número de telefone nos é facultado após um pedido de informações, um profissional do Departamento comercial, devidamente identificado pelo nome e em língua portuguesa, entra em contacto para confirmar a receção de informação e esclarecer eventuais dúvidas.
Qualquer outro indicativo internacional ou número diferente dos apresentados não deve ser considerado como sendo da NexiForma by FormaFuturo.

Depois do curso terminado entram em contacto?
A NexiForma by FormaFuturo entra em contacto para acompanhamento pós-formação três meses após o término. Pode também contactar para enviar propostas de emprego/prestação de serviços ou apresentar oferta formativa de atualização. Caso não queira ser contactado para este fim, deve indicar-nos por escrito.

Em que emails devo confiar?
Os emails confiáveis da NexiForma by FormaFuturo são:
• geral@formafuturoportugal.pt (Gerência)
• admin@formafuturoportugal.pt (administrador de Sistemas)
• noreply@nexiforma.pt (emails automáticos da plataforma)
Qualquer email proveniente de outro remetente deve contactar admin@formafuturoportugal.pt

Que documentos são solicitados?
Em cursos certificados setorialmente solicitamos CV. Solicitamos também cópia do certificado de habilitações e de um documento de identificação pessoal, nomeadamente, Cartão de Cidadão, Bilhete de Identidade ou Passaporte. Em caso de recusa de entrega de cópia, deve transcrever os dados para uma página A4 e declarar sob compromisso de honra.

Quais são os meus direitos?
A qualquer momento pode solicitar:
• Acesso à informação que temos sobre si, na opção do menu “RGPD” ou “Privacidade”
• Retificação de informação incorreta ou incompleta, na área pessoal
• Portabilidade dos dados, na área “RGPD” ou “Privacidade”
• Oposição ao tratamento para fins de marketing direto
A NexiForma by FormaFuturo tem o dever de informar o cliente caso ocorra uma fuga de informação. O cliente tem o direito de reclamar à CNPD.

Os meus dados são eliminados?
A formação certificada obriga à conservação dos registos até auditoria da entidade certificadora. Após auditoria, a NexiForma by FormaFuturo procede à eliminação dos processos com mais de cinco anos.

Posso revogar o meu consentimento?
A inscrição nos nossos cursos implica a autorização do tratamento dos dados pessoais, pois uma não autorização inviabiliza a frequência da formação. O titular tem o direito de retirar o consentimento a qualquer altura, embora não comprometa a licitude do tratamento previamente efetuado em nexiforma.pt na vista “RGPD” ou “Privacidade”.

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
