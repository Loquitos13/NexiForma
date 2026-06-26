export type OpenHtmlPrintResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Abre HTML numa nova janela e dispara impressão.
 * Usa blob URL em vez de document.write - compatível com noopener/navegadores modernos.
 */
export function openHtmlForPrint(html: string): OpenHtmlPrintResult {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return { ok: false, error: "Popup bloqueado – permite janelas emergentes." };
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    URL.revokeObjectURL(url);
    try {
      win.focus();
      win.print();
    } catch {
      /* janela fechada pelo utilizador */
    }
  };

  win.addEventListener("load", finish, { once: true });
  window.setTimeout(finish, 1500);

  return { ok: true };
}
