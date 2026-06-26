import { Logger } from "@nestjs/common";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import type { QueueTransport } from "./queue-transport.interface";

export class SqsQueueTransport implements QueueTransport {
  readonly name = "sqs";
  private readonly logger = new Logger(SqsQueueTransport.name);
  private polling = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly client: SQSClient,
    private readonly queueUrl: string,
  ) {}

  async enqueue(_key: string, payload: string): Promise<void> {
    await this.client.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: payload,
      }),
    );
  }

  startWorker(_key: string, handler: (payload: string) => Promise<void>): void {
    this.polling = true;
    this.logger.log(`Worker SQS activo (${this.queueUrl}).`);
    void this.pollLoop(handler);
  }

  async stop(): Promise<void> {
    this.polling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  private async pollLoop(handler: (payload: string) => Promise<void>) {
    while (this.polling) {
      try {
        const res = await this.client.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
            VisibilityTimeout: 60,
          }),
        );
        for (const msg of res.Messages ?? []) {
          if (!msg.Body || !msg.ReceiptHandle) continue;
          await handler(msg.Body);
          await this.client.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: msg.ReceiptHandle,
            }),
          );
        }
      } catch (err) {
        this.logger.error(`Falha poll SQS: ${String(err)}`);
        await sleep(5000);
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
