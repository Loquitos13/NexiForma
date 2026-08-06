import { setAccessToken } from "./access-token";
import { clearClientRateLimitBlock } from "./rate-limit-client";
import { clearPersistedTenantContext } from "./login-preferences";

/** Revoga sessão no servidor e limpa credenciais locais (logout ou login limpo). */
export async function purgeStaleAuthSession(): Promise<void> {
  setAccessToken(null);
  clearClientRateLimitBlock();
  clearPersistedTenantContext();
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    /* rede indisponível */
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await purgeStaleAuthSession();
  } finally {
    setAccessToken(null);
    clearPersistedTenantContext();
  }
}
