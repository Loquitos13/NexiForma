/** Email que o formando deve usar no Zoom/Teams para a assiduidade contar. */
export type EmailPresencaInput = {
  /** Definido pelo gestor - tem prioridade absoluta. */
  emailPresenca?: string | null;
  /** Email da conta NexiForma (login no tenant). */
  emailConta?: string | null;
  /** Email de contacto no perfil (quando não há conta). */
  emailContacto?: string | null;
};

export const ALERTA_PRESENCA = {
  SEM_EMAIL_REUNIAO: "sem_email_reuniao",
  EMAIL_REUNIAO_INCORRETO: "email_reuniao_incorreto",
  SO_PORTAL: "so_portal",
} as const;

export type AlertaPresencaCodigo = (typeof ALERTA_PRESENCA)[keyof typeof ALERTA_PRESENCA];

export const ALERTA_PRESENCA_LABELS: Record<AlertaPresencaCodigo, string> = {
  sem_email_reuniao: "Sem email de reunião configurado",
  email_reuniao_incorreto: "Entrou na reunião com email incorrecto",
  so_portal: "No portal mas sem confirmação na reunião",
};

export function resolverEmailPresencaFormando(input: EmailPresencaInput): string | null {
  const dedicado = input.emailPresenca?.trim();
  if (dedicado) return dedicado;
  const conta = input.emailConta?.trim();
  if (conta) return conta;
  const contacto = input.emailContacto?.trim();
  if (contacto) return contacto;
  return null;
}

export function emailPresencaConfiguradoPeloGestor(emailPresenca?: string | null): boolean {
  return !!emailPresenca?.trim();
}

/** Modalidades com sessões online / LMS que exigem email de reunião na matrícula. */
export function cursoExigeEmailPresenca(modalidade: string): boolean {
  const m = modalidade.trim().toLowerCase();
  return (
    m.includes("learning") ||
    m.includes("online") ||
    m === "e-learning" ||
    m === "b-learning" ||
    m === "blearning" ||
    m === "elearning"
  );
}
