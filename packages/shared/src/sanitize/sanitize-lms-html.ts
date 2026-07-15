import sanitizeHtml from "sanitize-html";

const LMS_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "h1",
    "h2",
    "h3",
    "figure",
    "figcaption",
    "video",
    "source",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "title", "width", "height", "loading"],
    a: ["href", "name", "target", "rel"],
    video: ["src", "controls", "poster", "width", "height"],
    source: ["src", "type"],
  },
  allowedSchemes: ["https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

/** Remove scripts, handlers e URLs perigosas de HTML de módulos LMS. */
export function sanitizeLmsHtml(html: string | null | undefined): string | null {
  if (html == null) return null;
  const trimmed = html.trim();
  if (!trimmed) return null;
  const clean = sanitizeHtml(trimmed, LMS_HTML_OPTIONS).trim();
  return clean || null;
}
