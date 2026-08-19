const TOKEN_RE = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

/** Tokens substituídos como HTML bruto (não escapados). */
export const DOCUMENT_HTML_TOKEN_KEYS = ["acao.conteudos_modulos", "entidade.assinatura"] as const;

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
  htmlKeys: string[] = [...DOCUMENT_HTML_TOKEN_KEYS],
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

/** Template em texto simples → HTML seguro para PDF (variáveis escapadas). */
export function mergeTemplatePlainTextToHtml(
  template: string,
  context: Record<string, string | number | null | undefined>,
  htmlKeys: string[] = [...DOCUMENT_HTML_TOKEN_KEYS],
): string {
  const htmlSet = new Set(htmlKeys);
  const parts: string[] = [];
  let lastIndex = 0;
  const re = new RegExp(TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    parts.push(escapeHtml(template.slice(lastIndex, m.index)));
    const key = m[1]!;
    const val = context[key];
    if (val === null || val === undefined || val === "") {
      parts.push(`{{${key}}}`);
    } else {
      const s = String(val);
      parts.push(htmlSet.has(key) ? s : escapeHtml(s));
    }
    lastIndex = m.index + m[0].length;
  }
  parts.push(escapeHtml(template.slice(lastIndex)));
  const plain = parts.join("");
  if (!plain.trim()) return "";
  return plain
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");
}

export function templateBodyLooksHtml(template: string): boolean {
  return /<[a-z][\s\S]*>/i.test(template);
}

/** Escolhe merge HTML vs texto simples consoante formato e conteúdo. */
export function resolveMergedTemplateBody(
  template: string,
  context: Record<string, string | number | null | undefined>,
  formato?: "texto" | "html",
): string {
  if (formato === "texto" && !templateBodyLooksHtml(template)) {
    return mergeTemplatePlainTextToHtml(template, context);
  }
  return mergeTemplateHtml(template, context);
}
