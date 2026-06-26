-- Pedidos de anulação de fatura + notificações portal + push

CREATE TYPE "FaturaPedidoAnulacaoEstado" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

CREATE TABLE "public"."faturas_pedidos_anulacao" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fatura_id" UUID NOT NULL,
  "solicitado_por_user_id" UUID NOT NULL,
  "motivo" TEXT NOT NULL,
  "estado" "FaturaPedidoAnulacaoEstado" NOT NULL DEFAULT 'PENDENTE',
  "resposta_motivo" TEXT,
  "resolvido_por_user_id" UUID,
  "resolvido_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "faturas_pedidos_anulacao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."notificacoes_portal" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "tipo" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "mensagem" TEXT NOT NULL,
  "link" TEXT,
  "lida" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notificacoes_portal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."push_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "faturas_pedidos_anulacao_fatura_id_idx" ON "public"."faturas_pedidos_anulacao"("fatura_id");
CREATE INDEX "faturas_pedidos_anulacao_estado_idx" ON "public"."faturas_pedidos_anulacao"("estado");
CREATE INDEX "notificacoes_portal_user_id_lida_idx" ON "public"."notificacoes_portal"("user_id", "lida");
CREATE INDEX "notificacoes_portal_tenant_id_idx" ON "public"."notificacoes_portal"("tenant_id");
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "public"."push_subscriptions"("endpoint");
CREATE INDEX "push_subscriptions_user_id_idx" ON "public"."push_subscriptions"("user_id");

ALTER TABLE "public"."faturas_pedidos_anulacao"
  ADD CONSTRAINT "faturas_pedidos_anulacao_fatura_id_fkey"
  FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas_comerciais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_pedidos_anulacao"
  ADD CONSTRAINT "faturas_pedidos_anulacao_solicitado_por_user_id_fkey"
  FOREIGN KEY ("solicitado_por_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."faturas_pedidos_anulacao"
  ADD CONSTRAINT "faturas_pedidos_anulacao_resolvido_por_user_id_fkey"
  FOREIGN KEY ("resolvido_por_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."notificacoes_portal"
  ADD CONSTRAINT "notificacoes_portal_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notificacoes_portal"
  ADD CONSTRAINT "notificacoes_portal_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
