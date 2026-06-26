/** Chave interna de storage (não URL pública). */
export function isModuloStorageRef(urlOuRef: string | null | undefined): boolean {
  return !!urlOuRef && urlOuRef.startsWith("lms/");
}

/** URL autenticada (cookie JWT) para servir ficheiro do módulo. */
export function moduloConteudoMediaUrl(moduloId: string): string {
  return `/api/v1/conteudos-lms/modulos/${moduloId}/media`;
}

/** Resolve URL para o browser (http(s), YouTube ou media API). */
export function resolveModuloConteudoUrl(
  modulo: { id: string; urlOuRef?: string | null },
): string | null {
  const ref = modulo.urlOuRef?.trim();
  if (!ref) return null;
  if (ref.startsWith("http://") || ref.startsWith("https://")) return ref;
  if (isModuloStorageRef(ref)) return moduloConteudoMediaUrl(modulo.id);
  return ref;
}
