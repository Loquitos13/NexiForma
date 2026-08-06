/** Utilitários para HTML de email compatível com clientes desktop e móveis (Outlook, Gmail, Apple Mail). */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailButtonVariant = "primary" | "success" | "secondary" | "danger";

const BUTTON_COLORS: Record<EmailButtonVariant, { bg: string; color: string }> = {
  primary: { bg: "#2563eb", color: "#ffffff" },
  success: { bg: "#0d9488", color: "#ffffff" },
  secondary: { bg: "#64748b", color: "#ffffff" },
  danger: { bg: "#dc2626", color: "#ffffff" },
};

/** Botão bulletproof (tabela) para Outlook e Gmail. */
export function emailButton(
  label: string,
  href: string,
  variant: EmailButtonVariant = "primary",
): string {
  const { bg, color } = BUTTON_COLORS[variant];
  const safeLabel = escapeHtml(label);
  const safeHref = href.replace(/"/g, "%22");
  return (
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" ` +
    `style="margin:8px 12px 8px 0;display:inline-table;vertical-align:top;">` +
    `<tr><td align="center" bgcolor="${bg}" style="border-radius:8px;background:${bg};mso-padding-alt:14px 28px;">` +
    `<a href="${safeHref}" target="_blank" ` +
    `style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:16px;font-weight:600;color:${color};text-decoration:none;border-radius:8px;line-height:1.25;">` +
    `${safeLabel}</a></td></tr></table>`
  );
}

export function emailButtonRow(buttonsHtml: string): string {
  return (
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;">` +
    `<tr><td>${buttonsHtml}</td></tr></table>`
  );
}

export function emailParagraph(html: string): string {
  return (
    `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:16px;line-height:1.6;color:#334155;">${html}</p>`
  );
}

export function emailHeading(text: string): string {
  return (
    `<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:22px;font-weight:700;line-height:1.35;color:#0f172a;">${escapeHtml(text)}</h1>`
  );
}

export function emailMuted(html: string): string {
  return (
    `<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;` +
    `font-size:13px;line-height:1.5;color:#64748b;">${html}</p>`
  );
}

export function emailInfoBox(contentHtml: string, accent = "#2563eb"): string {
  return (
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;">` +
    `<tr><td style="background:#f8fafc;border-left:4px solid ${accent};padding:16px 20px;` +
    `border-radius:0 8px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#334155;">` +
    contentHtml +
    `</td></tr></table>`
  );
}

export function emailDataRow(label: string, value: string): string {
  return (
    `<tr>` +
    `<td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
    `<td style="padding:6px 0;font-size:14px;color:#0f172a;vertical-align:top;"><strong>${value}</strong></td>` +
    `</tr>`
  );
}

export function emailDataTable(rowsHtml: string): string {
  return (
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">` +
    rowsHtml +
    `</table>`
  );
}

export type WrapEmailOptions = {
  preheader?: string;
  title?: string;
  footerNote?: string;
};

export function wrapEmailHtml(bodyHtml: string, options: WrapEmailOptions = {}): string {
  const title = escapeHtml(options.title ?? "NexiForma");
  const preheader = options.preheader ? escapeHtml(options.preheader) : "";
  const footerNote = options.footerNote ?? "";

  return `<!DOCTYPE html>
<html lang="pt" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
<title>${title}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<style type="text/css">body,table,td,p,a{font-family:Arial,Helvetica,sans-serif!important;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;word-break:break-word;">
${preheader ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">
<tr>
<td style="background-color:#1e293b;padding:24px 32px;text-align:center;">
<span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">NexiForma</span>
</td>
</tr>
<tr>
<td style="padding:32px 32px 24px;">
${bodyHtml}
</td>
</tr>
<tr>
<td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">
${footerNote ? `<p style="margin:0 0 8px;">${footerNote}</p>` : ""}
<p style="margin:0;">Plataforma de gestão de formação profissional</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
