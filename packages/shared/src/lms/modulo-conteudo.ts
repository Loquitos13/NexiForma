/** Remove tags HTML e normaliza espaços. */
export function stripHtmlTexto(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ModuloConteudoLike = {
  tipo: string;
  urlOuRef?: string | null;
  conteudoHtml?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function validarModuloConteudoCompleto(
  modulo: ModuloConteudoLike,
): { ok: true } | { ok: false; message: string } {
  switch (modulo.tipo) {
    case "TEXTO": {
      const text = stripHtmlTexto(modulo.conteudoHtml ?? "");
      if (!text) {
        return { ok: false, message: "O conteúdo de texto não pode estar vazio." };
      }
      return { ok: true };
    }
    case "VIDEO": {
      const ref = modulo.urlOuRef?.trim();
      if (!ref) {
        return { ok: false, message: "Carrega um vídeo ou indica um URL externo." };
      }
      return { ok: true };
    }
    case "PDF":
    case "SCORM": {
      const ref = modulo.urlOuRef?.trim();
      if (!ref) {
        return { ok: false, message: "Carrega um documento antes de publicar." };
      }
      return { ok: true };
    }
    case "WEBINAR": {
      const ref = modulo.urlOuRef?.trim();
      if (!ref) {
        return { ok: false, message: "Indica o URL do webinar." };
      }
      if (!/^https?:\/\//i.test(ref)) {
        return { ok: false, message: "O URL do webinar deve começar por http:// ou https://." };
      }
      return { ok: true };
    }
    case "QUIZ":
      return { ok: true };
    default:
      return { ok: true };
  }
}

/** Converte URL de webinar/vídeo externo para embed em iframe quando possível. */
export function parseYoutubeVideoId(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  const m =
    raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/i) ??
    raw.match(/youtube\.com\/watch\?.*v=([\w-]{11})/i);
  return m?.[1] ?? null;
}

export function parseVimeoVideoId(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  const m = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  return m?.[1] ?? null;
}

export function resolveWebinarEmbedUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;

  const yt = parseYoutubeVideoId(raw);
  if (yt) return `https://www.youtube.com/embed/${yt}`;

  const vimeo = parseVimeoVideoId(raw);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;

  if (/^https?:\/\//i.test(raw)) return raw;
  return null;
}
