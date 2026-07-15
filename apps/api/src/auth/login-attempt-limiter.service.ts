import {
  HttpException,
  HttpStatus,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  loginFailLockoutMs,
  loginFailMaxAttempts,
  loginFailWindowMs,
} from "../common/ddos-throttle.config";

export type LoginAttemptScope = "tenant" | "platform";

type AttemptRecord = {
  failures: number;
  windowStartedAt: number;
  lockedUntil?: number;
};

@Injectable()
export class LoginAttemptLimiterService implements OnModuleInit, OnModuleDestroy {
  private readonly store = new Map<string, AttemptRecord>();
  private pruneTimer?: ReturnType<typeof setInterval>;
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>("REDIS_URL")?.trim();
    if (url) {
      const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      void client
        .connect()
        .then(() => {
          this.redis = client;
        })
        .catch(() => {
          void client.quit();
        });
    }
    this.pruneTimer = setInterval(() => this.prune(), 60_000);
  }

  onModuleDestroy(): void {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    if (this.redis) void this.redis.quit();
  }

  private key(scope: LoginAttemptScope, identifier: string): string {
    return `${scope}:${identifier.trim().toLowerCase()}`;
  }

  private throwLocked(retryAfterSec: number): never {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Demasiadas tentativas com credenciais inválidas. Tente novamente em ${retryAfterSec} segundos.`,
        retryAfterSec,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async assertNotLocked(scope: LoginAttemptScope, identifier: string): Promise<void> {
    const k = this.key(scope, identifier);
    if (this.redis) {
      const ttl = await this.redis.ttl(`login_lock:${k}`);
      if (ttl > 0) this.throwLocked(ttl);
      return;
    }

    const record = this.store.get(k);
    if (!record?.lockedUntil) return;

    const now = Date.now();
    if (now >= record.lockedUntil) {
      this.store.delete(k);
      return;
    }

    this.throwLocked(Math.max(1, Math.ceil((record.lockedUntil - now) / 1000)));
  }

  async recordFailure(scope: LoginAttemptScope, identifier: string): Promise<void> {
    const k = this.key(scope, identifier);
    const windowMs = loginFailWindowMs();
    const maxAttempts = loginFailMaxAttempts();
    const lockoutMs = loginFailLockoutMs();
    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    const lockoutSec = Math.max(1, Math.ceil(lockoutMs / 1000));

    if (this.redis) {
      const failKey = `login_fail:${k}`;
      const count = await this.redis.incr(failKey);
      if (count === 1) await this.redis.expire(failKey, windowSec);
      if (count >= maxAttempts) {
        await this.redis.setex(`login_lock:${k}`, lockoutSec, "1");
      }
      return;
    }

    const now = Date.now();
    let record = this.store.get(k);
    if (!record || now - record.windowStartedAt > windowMs) {
      record = { failures: 1, windowStartedAt: now };
    } else {
      record.failures += 1;
    }
    if (record.failures >= maxAttempts) {
      record.lockedUntil = now + lockoutMs;
    }
    this.store.set(k, record);
  }

  async clear(scope: LoginAttemptScope, identifier: string): Promise<void> {
    const k = this.key(scope, identifier);
    if (this.redis) {
      await this.redis.del(`login_fail:${k}`, `login_lock:${k}`);
      return;
    }
    this.store.delete(k);
  }

  private prune(): void {
    const now = Date.now();
    const windowMs = loginFailWindowMs();
    for (const [k, record] of this.store) {
      const expiredLock = record.lockedUntil != null && now >= record.lockedUntil;
      const expiredWindow =
        record.lockedUntil == null && now - record.windowStartedAt > windowMs;
      if (expiredLock || expiredWindow) {
        this.store.delete(k);
      }
    }
  }
}
