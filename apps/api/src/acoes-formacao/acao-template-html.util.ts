import { MATRICULA_DOC_LABELS, type MatriculaDocCategoria } from "../formandos/matricula-documentos.util";

export function defaultTemplateHtml(
  categoria: MatriculaDocCategoria,
  ctx: { tituloAcao: string; codigoInterno: string; cargaHoras?: number | null; notas?: string | null },
): string {
  const label = MATRICULA_DOC_LABELS[categoria];
  const horas = ctx.cargaHoras != null ? `${ctx.cargaHoras} horas` : "-";
  const notas = ctx.notas?.trim()
    ? `<p><strong>Notas:</strong> ${escapeHtml(ctx.notas.trim())}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(label)}</title>
  <style>
    body { font-family: Georgia, serif; color: #111; line-height: 1.45; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 12px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 20px; }
    p { font-size: 13px; margin: 0 0 10px; }
    .assinatura { margin-top: 48px; display: flex; justify-content: space-between; gap: 24px; }
    .assinatura div { border-top: 1px solid #333; width: 45%; padding-top: 6px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(label)}</h1>
  <div class="meta">
    Acção: <strong>${escapeHtml(ctx.tituloAcao)}</strong><br/>
    Código: ${escapeHtml(ctx.codigoInterno)} · Carga: ${escapeHtml(horas)}
  </div>
  <p>
    Documento gerado pela entidade formadora para a inscrição nesta acção de formação.
    O formando deve ler, assinar (quando aplicável) e devolver o ficheiro no portal.
  </p>
  ${notas}
  <div class="assinatura">
    <div>A entidade formadora</div>
    <div>O/A formando/a</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
