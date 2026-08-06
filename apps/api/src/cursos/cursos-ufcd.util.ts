/**
 * Normaliza código UFCD de input de curso.
 * Validação de existência fica no serviço (CatalogoUfcdService).
 */
export function normalizeCursoCodigoUfcd(raw?: string | null): string | null {
  const codigo = raw?.trim() || "";
  return codigo.length ? codigo : null;
}
