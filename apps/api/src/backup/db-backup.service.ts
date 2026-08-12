import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile, readdir, unlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { StorageService } from "../storage/storage.service";

const execFileAsync = promisify(execFile);

export type DbBackupResult = {
  ok: boolean;
  key?: string;
  sizeBytes?: number;
  skipped?: boolean;
  reason?: string;
};

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  isEnabled(): boolean {
    const flag = this.config.get<string>("DB_BACKUP_ENABLED");
    if (flag === "0" || flag === "false") return false;
    if (flag === "1" || flag === "true") return true;
    return (this.config.get<string>("NODE_ENV") ?? "").toLowerCase() === "production";
  }

  async runScheduledBackup(): Promise<DbBackupResult> {
    if (!this.isEnabled()) {
      return { ok: true, skipped: true, reason: "DB_BACKUP_ENABLED off" };
    }
    if (this.running) {
      return { ok: true, skipped: true, reason: "backup already running" };
    }
    this.running = true;
    try {
      return await this.createBackup();
    } finally {
      this.running = false;
    }
  }

  async createBackup(): Promise<DbBackupResult> {
    const databaseUrl = this.config.get<string>("DATABASE_URL")?.trim();
    if (!databaseUrl) {
      this.logger.warn("DB backup: DATABASE_URL em falta.");
      return { ok: false, reason: "DATABASE_URL missing" };
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const keyPrefix = (this.config.get<string>("DB_BACKUP_PREFIX") ?? "backups/db").replace(
      /\/$/,
      "",
    );
    const key = `${keyPrefix}/nexiforma-${stamp}.sql.gz`;

    const tmp = await mkdtemp(path.join(tmpdir(), "nexiforma-db-backup-"));
    const sqlPath = path.join(tmp, "dump.sql");
    const gzPath = path.join(tmp, "dump.sql.gz");

    try {
      await this.pgDumpToFile(databaseUrl, sqlPath);
      await pipeline(createReadStream(sqlPath), createGzip({ level: 9 }), createWriteStream(gzPath));
      const body = await readFile(gzPath);
      await this.storage.putObject(key, body, "application/gzip");
      this.logger.log(`DB backup OK: ${key} (${body.byteLength} bytes)`);
      await this.pruneOldBackups(keyPrefix);
      return { ok: true, key, sizeBytes: body.byteLength };
    } catch (err) {
      this.logger.error(`DB backup falhou: ${String(err)}`);
      return { ok: false, reason: String(err) };
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async generateBackupBuffer(): Promise<{ filename: string; buffer: Buffer }> {
    const databaseUrl = this.config.get<string>("DATABASE_URL")?.trim();
    if (!databaseUrl) {
      throw new Error("DATABASE_URL em falta no ambiente.");
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `nexiforma_db_backup_${stamp}.sql.gz`;

    const tmp = await mkdtemp(path.join(tmpdir(), "nexiforma-db-dump-"));
    const sqlPath = path.join(tmp, "dump.sql");
    const gzPath = path.join(tmp, "dump.sql.gz");

    try {
      await this.pgDumpToFile(databaseUrl, sqlPath);
      await pipeline(createReadStream(sqlPath), createGzip({ level: 9 }), createWriteStream(gzPath));
      const buffer = await readFile(gzPath);
      return { filename, buffer };
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async pgDumpToFile(databaseUrl: string, outPath: string): Promise<void> {
    const pgDump = this.config.get<string>("PG_DUMP_PATH")?.trim() || "pg_dump";
    try {
      await execFileAsync(
        pgDump,
        ["--no-owner", "--no-acl", "--format=plain", `--file=${outPath}`, databaseUrl],
        { maxBuffer: 1024 * 1024 * 64, windowsHide: true },
      );
      return;
    } catch (err) {
      const msg = String(err);
      if (!/ENOENT|not found|não é reconhecido/i.test(msg)) {
        throw err;
      }
      this.logger.warn("pg_dump não encontrado no PATH - a tentar docker postgres.");
    }

    const container =
      this.config.get<string>("DB_BACKUP_DOCKER_CONTAINER")?.trim() || "nexiforma-postgres";
    const { stdout } = await execFileAsync(
      "docker",
      [
        "exec",
        container,
        "pg_dump",
        "-U",
        this.config.get<string>("POSTGRES_USER")?.trim() || "nexiforma",
        "-d",
        this.config.get<string>("POSTGRES_DB")?.trim() || "nexiforma",
        "--no-owner",
        "--no-acl",
        "--format=plain",
      ],
      { maxBuffer: 1024 * 1024 * 64, windowsHide: true, encoding: "utf8" },
    );
    await writeFile(outPath, stdout, "utf8");
  }

  /** Retenção: remove dumps locais antigos sob STORAGE local; em S3 a retenção deve ser lifecycle policy. */
  private async pruneOldBackups(keyPrefix: string): Promise<void> {
    const keep = Math.max(
      2,
      Number.parseInt(this.config.get<string>("DB_BACKUP_KEEP") ?? "28", 10) || 28,
    );
    if (this.storage.getBackend() !== "local") return;

    const root = path.resolve(
      this.config.get<string>("STORAGE_LOCAL_PATH") ?? path.join(process.cwd(), "storage"),
    );
    const dir = path.join(root, ...keyPrefix.split("/"));
    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return;
    }
    const dumps = files.filter((f) => f.endsWith(".sql.gz"));
    const withStat = await Promise.all(
      dumps.map(async (f) => {
        const full = path.join(dir, f);
        const s = await stat(full);
        return { full, mtime: s.mtimeMs };
      }),
    );
    withStat.sort((a, b) => b.mtime - a.mtime);
    for (const old of withStat.slice(keep)) {
      await unlink(old.full).catch(() => undefined);
    }
  }
}
