/** Evento para abrir o NexiGuia com pergunta pré-preenchida (fluxos guiados). */

export const NEXI_GUIA_ASK_EVENT = "nexiforma:nexi-guia-ask";

export type NexiGuiaAskDetail = {
  prompt: string;
  /** Se true, envia automaticamente após abrir. */
  autoSend?: boolean;
};

export function askNexiGuia(prompt: string, opts?: { autoSend?: boolean }) {
  if (typeof window === "undefined") return;
  const detail: NexiGuiaAskDetail = {
    prompt: prompt.trim(),
    autoSend: opts?.autoSend ?? true,
  };
  if (!detail.prompt) return;
  window.dispatchEvent(new CustomEvent(NEXI_GUIA_ASK_EVENT, { detail }));
}
