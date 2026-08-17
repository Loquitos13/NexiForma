const TOKEN_RE = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

/** Substitui {{variavel}} por valores do contexto. Chaves em falta mantêm-se. */
export function mergeTemplateContent(
  template: string,
  context: Record<string, string | number | null | undefined>,
): string {
  return template.replace(TOKEN_RE, (_match, key: string) => {
    const val = context[key];
    if (val === null || val === undefined || val === "") return `{{${key}}}`;
    return String(val);
  });
}

/** Lista tokens presentes no texto. */
export function extractTemplateTokens(template: string): string[] {
  const keys = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((m = re.exec(template)) !== null) {
    keys.add(m[1]!);
  }
  return [...keys];
}

/** Escapa HTML excepto blocos já marcados como HTML confiável (conteudos_modulos). */
export function mergeTemplateHtml(
  template: string,
  context: Record<string, string | number | null | undefined>,
  htmlKeys: string[] = ["acao.conteudos_modulos"],
): string {
  const htmlSet = new Set(htmlKeys);
  return template.replace(TOKEN_RE, (_match, key: string) => {
    const val = context[key];
    if (val === null || val === undefined || val === "") return `{{${key}}}`;
    const s = String(val);
    return htmlSet.has(key) ? s : escapeHtml(s);
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
