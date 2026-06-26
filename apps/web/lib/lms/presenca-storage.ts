export const PRESENCA_ATIVA_KEY = "nexiforma_presenca_ativa";

export type PresencaAtivaStorage = {
  matriculaId: string;
  sessaoId: string;
};

export function guardarPresencaAtiva(data: PresencaAtivaStorage) {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(data);
  sessionStorage.setItem(PRESENCA_ATIVA_KEY, raw);
  localStorage.setItem(PRESENCA_ATIVA_KEY, raw);
  localStorage.setItem(`${PRESENCA_ATIVA_KEY}:sync`, String(Date.now()));
}

export function limparPresencaAtiva() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PRESENCA_ATIVA_KEY);
  localStorage.removeItem(PRESENCA_ATIVA_KEY);
  localStorage.setItem(`${PRESENCA_ATIVA_KEY}:sync`, String(Date.now()));
}

export function lerPresencaAtiva(): PresencaAtivaStorage | null {
  if (typeof window === "undefined") return null;
  const raw =
    sessionStorage.getItem(PRESENCA_ATIVA_KEY) ??
    localStorage.getItem(PRESENCA_ATIVA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PresencaAtivaStorage;
  } catch {
    return null;
  }
}
