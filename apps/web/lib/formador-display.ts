/** Primeiro + último nome (ou completo se ≤2 palavras). */
export function formadorNomeCurto(nomeCompleto: string): string {
  const parts = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" ");
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function formadorIniciais(nomeCompleto: string): string {
  const parts = nomeCompleto.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/** Subtítulo no picker (CCP ou email). */
export function formadorSubtitulo(f: {
  ccpNumero?: string | null;
  email?: string | null;
}): string {
  const ccp = f.ccpNumero?.trim();
  if (ccp) return `CCP ${ccp}`;
  return f.email?.trim() || "Formador";
}

/** Nome curto na lista; completo se houver homónimos no curto. */
export function formadorNomeBadge(nomeCompleto: string, todosNomes: string[]): string {
  const curto = formadorNomeCurto(nomeCompleto);
  const homonimos = todosNomes.filter((n) => formadorNomeCurto(n) === curto).length > 1;
  return homonimos ? nomeCompleto.trim() : curto;
}
