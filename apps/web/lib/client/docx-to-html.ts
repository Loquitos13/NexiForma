import mammoth from "mammoth";

export type DocxImportResult = {
  html: string;
  warnings: string[];
};

/** Converte ficheiro DOCX em HTML para o editor de templates. */
export async function convertDocxFileToHtml(file: File): Promise<DocxImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Título'] => h1:fresh",
        "p[style-name='Título 1'] => h1:fresh",
        "p[style-name='Título 2'] => h2:fresh",
        "p[style-name='Título 3'] => h3:fresh",
      ],
    },
  );
  const html = result.value?.trim() ? result.value : "<p></p>";
  return {
    html,
    warnings: result.messages.map((m) => m.message),
  };
}
