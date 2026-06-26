import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Procura `.env` na raiz do monorepo (cwd pode ser `apps/api` via npm workspaces). */
export function resolveEnvFilePaths(): string[] {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
  ];
  const found = candidates.filter((p) => existsSync(p));
  return found.length > 0 ? found : [resolve(process.cwd(), ".env")];
}
