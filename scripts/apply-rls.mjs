#!/usr/bin/env node
/**
 * Reaplica políticas RLS (idempotente). Usa DATABASE_URL do .env na raiz.
 * Uso: npm run db:rls
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = resolve(root, "packages/database/prisma/rls/enable_rls.sql");

if (!existsSync(sqlPath)) {
  console.error("Ficheiro RLS não encontrado:", sqlPath);
  process.exit(1);
}

const loader = resolve(root, "scripts/load-root-env.mjs");
const result = spawnSync(
  process.execPath,
  [loader, "db", "execute", "--file", sqlPath, "--schema", "public"],
  { cwd: resolve(root, "packages/database"), stdio: "inherit", env: process.env },
);

if (result.status !== 0) {
  console.error("\nFalha ao aplicar RLS. Confirma que o Postgres está a correr:");
  console.error("  docker compose up -d postgres");
  console.error("  npm run db:migrate:deploy");
  process.exit(result.status ?? 1);
}

console.log("RLS aplicado com sucesso.");
