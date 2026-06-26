export type FormandoMeResponse = {
  id: string;
  nome: string;
  nif: string;
  telefone: string | null;
  email: string | null;
  emailEditavel: boolean;
  /** Email a usar no Zoom/Teams para a assiduidade contar na reunião. */
  emailPresencaReuniao: string | null;
  emailPresencaDefinidoPeloGestor: boolean;
  tenantLegalName: string | null;
  tenantSlug: string | null;
};
