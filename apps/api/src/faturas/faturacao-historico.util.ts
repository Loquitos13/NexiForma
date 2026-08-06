/**
 * Política legal AT / certificação: o histórico de faturação é imutável.
 * É expressamente proibido apagar faturas, séries ou comunicações AT.
 * Correcções: anulação (ChangeInvoiceStatus), nota de crédito (NC) ou nota de débito (ND).
 */

export const FATURACAO_HISTORICO_IMUTAVEL_MSG =
  "É expressamente proibido apagar histórico de faturação. Use anulação, nota de crédito ou nota de débito.";
