export type OpenMeetingResult = { opened: boolean; blocked: boolean };

/**
 * Abre a sala Zoom/Teams numa nova aba.
 * Deve ser chamado no gesto do utilizador (clique) para evitar bloqueio de popups.
 */
export function openMeetingUrl(url: string): OpenMeetingResult {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) return { opened: true, blocked: false };
  return { opened: false, blocked: true };
}
