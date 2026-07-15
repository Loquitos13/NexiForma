import { setAccessToken } from "./access-token";
import { refreshViaBffCookies } from "./bff-fetch";

type LoginBody = { accessToken?: string };

/**
 * Após login, impersonação ou resgate de chave, grava o access JWT novo.
 * Sem isto, o portal continua a enviar o token antigo (ex.: super_admin) → 403.
 */
export async function persistAuthFromResponse(res: Response): Promise<void> {
  const data = (await res.json().catch(() => null)) as LoginBody | null;
  if (typeof data?.accessToken === "string" && data.accessToken.length > 0) {
    setAccessToken(data.accessToken);
    return;
  }
  await refreshViaBffCookies();
}
