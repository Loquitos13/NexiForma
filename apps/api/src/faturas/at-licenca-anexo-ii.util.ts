/** Versão da licença Anexo II (Contrato de adesão webservice AT). */
export const AT_LICENCA_ANEXO_II_VERSAO = "contrato-adesao-ws-anexo-ii-v1";

/**
 * Texto da Licença de utilização (Anexo II do Contrato de adesão aos webservices AT).
 * Fonte: Contrato_de_adesao-ws.pdf - Autoridade Tributária e Aduaneira.
 */
export const AT_LICENCA_ANEXO_II_TEXTO = `Licença de utilização de serviços web para comunicação dos elementos das faturas

Este documento descreve os termos em que a Autoridade Tributária e Aduaneira (AT) fornecerá aos sujeitos passivos e respectivos representantes serviços Web invocados a partir de software comercial para comunicação dos elementos das faturas por via electrónica.

É indispensável que aceite os termos desta licença. Caso discorde, não utilize esta funcionalidade.

1. O fornecimento dos serviços web para comunicação dos elementos das faturas é efectuado a título gratuito.

2. Poderá utilizar os serviços mencionados no número anterior desde que expressamente aceite as condições de acesso e utilização fixadas no presente contrato.

3. Os serviços web estão exclusivamente disponíveis para cumprimento das obrigações fiscais, sendo a utilização para outros fins expressamente proibida.

4. É da responsabilidade do sujeito passivo a actividade desenvolvida com os respectivos códigos de acesso, pessoais e intransmissíveis, para utilização dos serviços web, assim como para tratamento e divulgação da informação obtida através daqueles serviços.

5. É expressamente proibido:
a) aceder, de forma não autorizada, aos serviços web;
b) divulgar, partilhar ou comprometer os serviços web e as senhas de acesso;
c) utilizar, de forma não autorizada, os serviços web em nome de outro contribuinte, bem como a respectiva senha de acesso;
d) alterar a estrutura dos serviços web ou das senhas de acesso, excepto as requeridas no exercício normal da actividade do utilizador;
e) ultrapassar ou comprometer os dispositivos de segurança relacionados com os serviços web;
f) alterar ou copiar o código fonte associado aos serviços web.

6. A proibição especificada no número anterior abrange a tentativa.

7. A falha ou indisponibilidade dos serviços web não constituem fundamento para incumprimento das obrigações fiscais inerentes por parte do sujeito passivo, devendo-se recorrer, nestas situações, aos outros meios disponíveis para comunicação dos elementos das faturas.

8. Os serviços web serão suspensos, por prevenção, caso esteja em risco a operacionalidade do sistema e enquanto persistir a causa determinante da suspensão.

9. Os serviços web estão disponíveis sem garantias adicionais, sendo da responsabilidade do utilizador a assunção de todos os riscos inerentes à indisponibilidade ou danos que venham a ocorrer.`;

export function isAtLicencaAnexoIiAceite(config: {
  atLicencaAceiteEm?: Date | string | null;
  atLicencaVersao?: string | null;
}): boolean {
  if (!config.atLicencaAceiteEm) return false;
  const versao = config.atLicencaVersao?.trim();
  return !versao || versao === AT_LICENCA_ANEXO_II_VERSAO;
}
