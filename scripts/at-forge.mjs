import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const requireFromApi = createRequire(resolve(root, "apps/api/package.json"));

/** node-forge está declarado em apps/api — reutilizar sem duplicar dependência. */
export function loadNodeForge() {
  return requireFromApi("node-forge");
}

export { root };
