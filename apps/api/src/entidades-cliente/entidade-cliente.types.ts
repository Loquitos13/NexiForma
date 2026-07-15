/** Resposta API portable (sem tipos internos Prisma/Decimal). */
export type EntidadeClienteResposta = {
  id: string;
  tenantId: string;
  nif: string;
  nome: string;
  moradaFiscal: string | null;
  email: string | null;
  telefone: string | null;
  isParceiro: boolean;
  descontoPercent: number | null;
  createdAt: Date;
  _count?: { propostas: number };
};
