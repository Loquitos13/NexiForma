/**
 * prisma generate com mensagem clara quando o engine DLL está bloqueado (Windows).
 * Causa habitual: API a correr (`npm run dev:api`) com o client Prisma carregado.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(scriptDir, "..", ".env");
const repoRoot = resolve(scriptDir, "..");
const databaseDir = resolve(repoRoot, "packages", "database");

if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const result = spawnSync("npx", ["prisma", "generate"], {
  stdio: "pipe",
  shell: true,
  env: process.env,
  cwd: databaseDir,
  encoding: "utf8",
});

const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
if (out) process.stdout.write(out);

if (result.status === 0) {
  process.exit(0);
}

if (/EPERM|operation not permitted/i.test(out)) {
  console.error("");
  console.error("[prisma-generate] O query engine está bloqueado por outro processo Node.");
  console.error("  1. Para a API: Ctrl+C no terminal do `npm run dev:api`");
  console.error("  2. Fecha Prisma Studio se estiver aberto");
  console.error("  3. Volta a correr: npm run db:generate");
  console.error("");
  console.error("Windows (libertar porta API - ajusta 3001 se o teu .env usar outra):");
  console.error(
    '  Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }',
  );
}

process.exit(result.status ?? 1);
