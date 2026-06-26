export type SigoHttpOptions = {
  timeoutMs: number;
  maxRetries?: number;
  headers?: Record<string, string>;
};

export type SigoHttpResult = {
  statusCode: number;
  body: string;
  json: unknown;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonSafe(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

/** Pedido HTTP com timeout e retry exponencial simples. */
export async function sigoHttpRequest(
  url: string,
  init: RequestInit,
  options: SigoHttpOptions,
): Promise<SigoHttpResult> {
  const maxRetries = options.maxRetries ?? 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const body = await res.text();
      return {
        statusCode: res.status,
        body,
        json: parseJsonSafe(body),
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Pedido SIGO falhou.");
}

export function interpolatePath(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? "");
}
