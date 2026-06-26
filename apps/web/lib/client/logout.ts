import { bffFetch } from "./bff-fetch";
import { setAccessToken } from "./access-token";

export async function logoutSession(): Promise<void> {
  try {
    await bffFetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      authRetry401: false,
    });
  } finally {
    setAccessToken(null);
  }
}
