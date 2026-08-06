export const PAUTA_TIPO_PREFIX = "pauta:";

export function pautaTipo(moduloUnidadeId: string): string {
  return `${PAUTA_TIPO_PREFIX}${moduloUnidadeId}`;
}

export function moduloIdFromPautaTipo(tipo: string): string | null {
  if (!tipo.startsWith(PAUTA_TIPO_PREFIX)) return null;
  const id = tipo.slice(PAUTA_TIPO_PREFIX.length).trim();
  return id || null;
}
