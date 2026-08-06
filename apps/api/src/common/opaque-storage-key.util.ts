import { createHash, randomUUID } from "crypto";

/**
 * Chave de armazenamento opaca (sem nome de ficheiro legível).
 * O path real no storage não revela o título do documento ao cliente.
 */
export function opaqueStorageKey(parts: string[]): string {
  const token = createHash("sha256").update(randomUUID()).digest("hex").slice(0, 40);
  const safe = parts
    .map((p) => p.replace(/[^a-zA-Z0-9_-]+/g, "").slice(0, 64))
    .filter(Boolean);
  return [...safe, token].join("/");
}
