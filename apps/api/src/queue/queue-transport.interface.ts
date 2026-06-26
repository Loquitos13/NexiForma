/** Transporte de fila (Redis dev, SQS produção). */
export interface QueueTransport {
  readonly name: string;
  enqueue(key: string, payload: string): Promise<void>;
  /** Inicia worker; `handler` processa cada mensagem (corpo JSON). */
  startWorker(key: string, handler: (payload: string) => Promise<void>): void;
  stop(): Promise<void>;
}
