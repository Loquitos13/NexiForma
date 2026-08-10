import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolveS3SsePutOptions, type S3SsePutOptions } from "./s3-sse.util";

export type StorageBackend = "local" | "s3";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly backend: StorageBackend;
  private readonly s3: S3Client | null;
  private readonly bucket: string | null;
  private readonly localRoot: string;
  private readonly sse: S3SsePutOptions | null;

  constructor(private readonly config: ConfigService) {
    const mode = (this.config.get<string>("STORAGE_BACKEND") ?? "local").toLowerCase();
    this.backend = mode === "s3" ? "s3" : "local";
    this.bucket = this.config.get<string>("S3_BUCKET") ?? null;
    this.localRoot = path.resolve(
      this.config.get<string>("STORAGE_LOCAL_PATH") ?? path.join(process.cwd(), "storage"),
    );
    if (this.backend === "s3") {
      const region = this.config.get<string>("AWS_REGION") ?? "eu-west-1";
      this.s3 = new S3Client({ region });
      this.sse = resolveS3SsePutOptions({
        S3_SSE_ALGORITHM: this.config.get<string>("S3_SSE_ALGORITHM"),
        S3_KMS_KEY_ID: this.config.get<string>("S3_KMS_KEY_ID"),
      });
      this.logger.log(
        `Storage: S3 bucket=${this.bucket} region=${region} sse=${this.sse.ServerSideEncryption}`,
      );
    } else {
      this.s3 = null;
      this.sse = null;
      this.logger.log(`Storage: local root=${this.localRoot}`);
    }
  }

  getBackend(): StorageBackend {
    return this.backend;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<{ key: string; size: number }> {
    if (this.backend === "s3") {
      if (!this.s3 || !this.bucket) {
        throw new Error("S3_BUCKET em falta para STORAGE_BACKEND=s3.");
      }
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ...(this.sse ?? { ServerSideEncryption: "AES256" }),
        }),
      );
      return { key, size: body.byteLength };
    }

    const full = path.join(this.localRoot, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    this.logger.debug(`Ficheiro local: ${full}`);
    return { key, size: body.byteLength };
  }

  async getObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    if (this.backend === "s3") {
      if (!this.s3 || !this.bucket) return null;
      try {
        const out = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        const bytes = await out.Body?.transformToByteArray();
        if (!bytes) return null;
        return {
          body: Buffer.from(bytes),
          contentType: out.ContentType ?? this.guessContentType(key),
        };
      } catch {
        return null;
      }
    }
    const full = path.join(this.localRoot, key);
    try {
      const { readFile } = await import("node:fs/promises");
      const body = await readFile(full);
      return { body, contentType: this.guessContentType(key) };
    } catch {
      return null;
    }
  }

  /** Remove object do storage (local ou S3). Falhas são registadas mas não propagadas. */
  async deleteObject(key: string): Promise<void> {
    if (!key?.trim()) return;

    if (this.backend === "s3") {
      if (!this.s3 || !this.bucket) return;
      try {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        this.logger.debug(`S3 removido: ${key}`);
      } catch (err) {
        this.logger.warn(`Falha ao remover S3 ${key}: ${String(err)}`);
      }
      return;
    }

    const full = path.join(this.localRoot, key);
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(full);
      this.logger.debug(`Ficheiro local removido: ${full}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        this.logger.warn(`Falha ao remover ficheiro local ${full}: ${String(err)}`);
      }
    }
  }

  guessContentType(key: string): string {
    const ext = path.extname(key).toLowerCase();
    const map: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".htm": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".xml": "application/xml; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".mp4": "video/mp4",
      ".pdf": "application/pdf",
      ".zip": "application/zip",
    };
    return map[ext] ?? "application/octet-stream";
  }

  /** URL base para assets SCORM servidos via API (BFF reescreve /v1 → /api/v1). */
  scormAssetBaseUrl(moduloId: string): string {
    const publicBase = this.config.get<string>("APP_PUBLIC_URL")?.replace(/\/$/, "");
    if (publicBase) {
      return `${publicBase}/api/v1/conteudos-lms/scorm/assets/${moduloId}`;
    }
    return `/api/v1/conteudos-lms/scorm/assets/${moduloId}`;
  }

  async getDownloadUrl(key: string, expiresSeconds = 3600): Promise<string> {
    if (this.backend === "s3") {
      if (!this.s3 || !this.bucket) {
        throw new Error("S3 não configurado.");
      }
      return getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: expiresSeconds },
      );
    }
    const base = this.config.get<string>("STORAGE_PUBLIC_BASE_URL");
    if (base) {
      return `${base.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
    }
    const full = path.join(this.localRoot, key);
    this.logger.debug(`getDownloadUrl local: ${full} (preferir endpoint API autenticado no browser)`);
    return `file://${full}`;
  }
}
