import { Logger } from "@nestjs/common";
import Redis from "ioredis";
import type { QueueTransport } from "./queue-transport.interface";

export class RedisQueueTransport implements QueueTransport {
  readonly name = "redis";
  private readonly logger = new Logger(RedisQueueTransport.name);
  private workerTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly redis: Redis) {}

  async enqueue(key: string, payload: string): Promise<void> {
    await this.redis.lpush(key, payload);
  }

  startWorker(key: string, handler: (payload: string) => Promise<void>): void {
    this.workerTimer = setInterval(() => {
      void this.drainOne(key, handler);
    }, 500);
    this.logger.log(`Worker Redis activo (${key}).`);
  }

  async stop(): Promise<void> {
    if (this.workerTimer) clearInterval(this.workerTimer);
    await this.redis.quit();
  }

  private async drainOne(key: string, handler: (payload: string) => Promise<void>) {
    try {
      const item = await this.redis.rpop(key);
      if (!item) return;
      await handler(item);
    } catch (err) {
      this.logger.error(`Falha worker Redis: ${String(err)}`);
    }
  }
}
