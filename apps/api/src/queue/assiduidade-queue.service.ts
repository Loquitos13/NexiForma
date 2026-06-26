import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SQSClient } from "@aws-sdk/client-sqs";
import Redis from "ioredis";
import { AssiduidadeService } from "../assiduidade/assiduidade.service";
import type { TeamsWebhookDto, ZoomWebhookDto } from "../assiduidade/dto/assiduidade.dto";
import type { QueueTransport } from "./queue-transport.interface";
import { RedisQueueTransport } from "./redis-queue.transport";
import { SqsQueueTransport } from "./sqs-queue.transport";

const QUEUE_KEY_ZOOM = "nexiforma:assiduidade:zoom";
const QUEUE_KEY_TEAMS = "nexiforma:assiduidade:teams";

export type QueueBackend = "sync" | "redis" | "sqs";

@Injectable()
export class AssiduidadeQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssiduidadeQueueService.name);
  private transport: QueueTransport | null = null;
  private backend: QueueBackend = "sync";

  constructor(
    private readonly config: ConfigService,
    private readonly assiduidade: AssiduidadeService,
  ) {}

  getBackend(): QueueBackend {
    return this.backend;
  }

  onModuleInit() {
    if (this.config.get<string>("QUEUE_ENABLED") === "false") {
      this.backend = "sync";
      this.logger.warn("Fila desactivada (QUEUE_ENABLED=false) – webhooks síncronos.");
      return;
    }

    const configured = (this.config.get<string>("QUEUE_BACKEND") ?? "redis").toLowerCase();
    if (configured === "sqs") {
      const url = this.config.get<string>("SQS_ASSIDUIDADE_URL");
      if (!url) {
        this.logger.warn("SQS_ASSIDUIDADE_URL em falta – fallback síncrono.");
        this.backend = "sync";
        return;
      }
      const region = this.config.get<string>("AWS_REGION") ?? "eu-west-1";
      const client = new SQSClient({ region });
      this.transport = new SqsQueueTransport(client, url);
      this.backend = "sqs";
    } else if (configured === "redis") {
      const url = this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
      try {
        const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
        void redis.connect().then(() => {
          this.transport = new RedisQueueTransport(redis);
          this.backend = "redis";
          this.transport.startWorker(QUEUE_KEY_ZOOM, (body) => this.processZoomBody(body));
          this.transport.startWorker(QUEUE_KEY_TEAMS, (body) => this.processTeamsBody(body));
        });
      } catch {
        this.logger.warn("Redis indisponível – webhooks Zoom síncronos.");
        this.backend = "sync";
      }
      return;
    } else {
      this.backend = "sync";
      return;
    }

    this.transport?.startWorker(QUEUE_KEY_ZOOM, (body) => this.processZoomBody(body));
    this.transport?.startWorker(QUEUE_KEY_TEAMS, (body) => this.processTeamsBody(body));
  }

  async onModuleDestroy() {
    await this.transport?.stop();
  }

  async enqueueZoom(dto: ZoomWebhookDto, token: string | undefined) {
    if (!this.transport) {
      return this.assiduidade.handleZoomWebhook(dto, token);
    }
    await this.transport.enqueue(QUEUE_KEY_ZOOM, JSON.stringify({ dto, token }));
    return { queued: true, backend: this.backend };
  }

  async enqueueTeams(dto: TeamsWebhookDto, token: string | undefined) {
    if (!this.transport) {
      return this.assiduidade.handleTeamsWebhook(dto, token);
    }
    await this.transport.enqueue(QUEUE_KEY_TEAMS, JSON.stringify({ dto, token }));
    return { queued: true, backend: this.backend };
  }

  private async processZoomBody(body: string) {
    const parsed = JSON.parse(body) as { dto: ZoomWebhookDto; token?: string };
    await this.assiduidade.handleZoomWebhook(parsed.dto, parsed.token);
  }

  private async processTeamsBody(body: string) {
    const parsed = JSON.parse(body) as { dto: TeamsWebhookDto; token?: string };
    await this.assiduidade.handleTeamsWebhook(parsed.dto, parsed.token);
  }
}
