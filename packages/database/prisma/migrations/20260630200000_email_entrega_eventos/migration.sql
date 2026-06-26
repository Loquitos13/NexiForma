-- Registo de bounces/complaints SES (webhook SNS)

CREATE TYPE "EmailEntregaTipo" AS ENUM ('BOUNCE', 'COMPLAINT', 'DELIVERY');

CREATE TABLE "public"."email_entrega_eventos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tipo" "EmailEntregaTipo" NOT NULL,
  "destinatario" TEXT NOT NULL,
  "motivo" TEXT,
  "message_id" TEXT,
  "detalhe" JSONB,
  "ocorrido_em" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_entrega_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_entrega_eventos_tipo_idx" ON "public"."email_entrega_eventos"("tipo");
CREATE INDEX "email_entrega_eventos_destinatario_idx" ON "public"."email_entrega_eventos"("destinatario");
CREATE INDEX "email_entrega_eventos_ocorrido_em_idx" ON "public"."email_entrega_eventos"("ocorrido_em");
