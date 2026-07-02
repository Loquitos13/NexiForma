import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const PROJECT_PATH_BASES = [
  process.cwd(),
  resolve(process.cwd(), ".."),
  resolve(process.cwd(), "..", ".."),
];

/** Procura `.env` na raiz do monorepo (cwd pode ser `apps/api` via npm workspaces). */
export function resolveEnvFilePaths(): string[] {
  const candidates = PROJECT_PATH_BASES.map((base) => resolve(base, ".env"));
  const found = candidates.filter((p) => existsSync(p));
  return found.length > 0 ? found : [resolve(process.cwd(), ".env")];
}

/**
 * Resolve caminhos relativos (ex. `./certs/foo.pem`) independentemente do cwd
 * (`apps/api` via npm workspaces vs raiz do monorepo).
 */
export function resolveProjectPath(pathValue: string | null | undefined): string | undefined {
  const trimmed = pathValue?.trim();
  if (!trimmed) return undefined;
  if (isAbsolute(trimmed)) return trimmed;

  for (const base of PROJECT_PATH_BASES) {
    const candidate = resolve(base, trimmed);
    if (existsSync(candidate)) return candidate;
  }

  return resolve(PROJECT_PATH_BASES[PROJECT_PATH_BASES.length - 1], trimmed);
}
