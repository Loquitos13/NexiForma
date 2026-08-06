/** Email de contacto para notificações (não confundir com emailPresenca Zoom/Teams). */
export type EmailNotificacaoFormandoInput = {
  emailContacto?: string | null;
  emailConta?: string | null;
};

export type EmailNotificacaoFormadorInput = {
  emailPerfil?: string | null;
  emailConta?: string | null;
};

/** Perfil formando: email de contacto → email da conta. */
export function resolverEmailNotificacaoFormando(
  input: EmailNotificacaoFormandoInput,
): string | null {
  const contacto = input.emailContacto?.trim();
  if (contacto) return contacto;
  const conta = input.emailConta?.trim();
  if (conta) return conta;
  return null;
}

/** Perfil formador: email do perfil → email da conta. */
export function resolverEmailNotificacaoFormador(
  input: EmailNotificacaoFormadorInput,
): string | null {
  const perfil = input.emailPerfil?.trim();
  if (perfil) return perfil;
  const conta = input.emailConta?.trim();
  if (conta) return conta;
  return null;
}

export function resolverEmailUtilizador(email?: string | null): string | null {
  const e = email?.trim();
  return e || null;
}

/** Contas de seed/dev que provedores SMTP reais não entregam. */
export function isEmailNaoEntregavelDev(email?: string | null): boolean {
  const e = email?.trim().toLowerCase();
  if (!e || !e.includes("@")) return true;
  const domain = e.split("@").pop() ?? "";
  return (
    domain === "localhost" ||
    domain === "local" ||
    domain.endsWith(".local") ||
    domain.endsWith(".test") ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".example")
  );
}

/**
 * Resolve destino SMTP: se o email for não entregável (ex. @demo.local),
 * usa `fallback` (tipicamente MAIL_REPLY_TO).
 */
export function resolverEmailEntregavel(
  email?: string | null,
  fallback?: string | null,
): string | null {
  const primary = resolverEmailUtilizador(email);
  if (primary && !isEmailNaoEntregavelDev(primary)) return primary;
  const fb = resolverEmailUtilizador(fallback);
  if (fb && !isEmailNaoEntregavelDev(fb)) return fb;
  return null;
}
