/**
 * Backup manual da BD (pg_dump → storage/backups/db/*.sql.gz).
 * Uso: npm run db:backup
 * Em produção a API também corre isto a cada 12h (DB_BACKUP_ENABLED).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, createWriteStream, readFileSync, existsSync } from "node:fs";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL em falta.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(
  root,
  process.env.STORAGE_LOCAL_PATH || "storage",
  "backups",
  "db",
);
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `nexiforma-${stamp}.sql.gz`);
const tmp = mkdtempSync(path.join(tmpdir(), "nexiforma-db-backup-"));
const sqlPath = path.join(tmp, "dump.sql");

try {
  const dump = spawnSync(
    process.env.PG_DUMP_PATH || "pg_dump",
    ["--no-owner", "--no-acl", "--format=plain", `--file=${sqlPath}`, databaseUrl],
    { encoding: "utf8", windowsHide: true },
  );
  if (dump.status !== 0) {
    console.error(dump.stderr || dump.stdout || "pg_dump falhou");
    process.exit(dump.status || 1);
  }
  await pipeline(createReadStream(sqlPath), createGzip({ level: 9 }), createWriteStream(outFile));
  console.log(`Backup OK: ${outFile}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
