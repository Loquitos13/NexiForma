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
