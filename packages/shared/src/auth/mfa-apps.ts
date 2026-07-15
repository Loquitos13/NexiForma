/** Apps de autenticação em dois passos (código de 6 dígitos) suportadas no registo MFA. */
export const MFA_APP_CODES = [
  "microsoft_authenticator",
  "google_authenticator",
  "authy",
  "1password",
  "other",
] as const;

export type MfaAppCode = (typeof MFA_APP_CODES)[number];

export const MFA_APP_LABELS: Record<MfaAppCode, string> = {
  microsoft_authenticator: "Microsoft Authenticator",
  google_authenticator: "Google Authenticator",
  authy: "Authy",
  "1password": "1Password",
  other: "Outra app autenticadora",
};

const DEFAULT_LABEL = "a tua app autenticadora";

export function isMfaAppCode(value: string): value is MfaAppCode {
  return (MFA_APP_CODES as readonly string[]).includes(value);
}

/** Nome amigável da app (para mostrar ao utilizador). */
export function mfaAppDisplayLabel(code: string | null | undefined): string {
  if (code && isMfaAppCode(code)) return MFA_APP_LABELS[code];
  return DEFAULT_LABEL;
}

/** Instrução curta para abrir a app certa. */
export function mfaAppOpenHint(code: string | null | undefined): string {
  const label = mfaAppDisplayLabel(code);
  if (!code || code === "other") {
    return `Abre ${label} no telemóvel e copia o código de 6 dígitos que aparece para NexiForma.`;
  }
  return `Abre a app ${label} no telemóvel e copia o código de 6 dígitos que aparece para NexiForma.`;
}

/** Texto para o passo de verificação no login. */
export function mfaVerificationSubtitle(code: string | null | undefined): string {
  return `Introduz o código de 6 dígitos que vês em ${mfaAppDisplayLabel(code)}.`;
}
