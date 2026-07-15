ALTER TABLE "public"."interaccoes_comerciais"
  ADD COLUMN IF NOT EXISTS "agendado_para" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "agendado_fim" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "participantes_ids" JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "interaccoes_comerciais_tenant_id_agendado_para_idx"
  ON "public"."interaccoes_comerciais"("tenant_id", "agendado_para");

CREATE TABLE IF NOT EXISTS "public"."calendario_lembrete_logs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "fonte" VARCHAR(32) NOT NULL,
  "fonte_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "tipo" VARCHAR(24) NOT NULL,
  "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calendario_lembrete_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "calendario_lembrete_logs_fonte_fonte_id_user_id_tipo_key"
  ON "public"."calendario_lembrete_logs"("fonte", "fonte_id", "user_id", "tipo");

CREATE INDEX IF NOT EXISTS "calendario_lembrete_logs_tenant_id_fonte_fonte_id_idx"
  ON "public"."calendario_lembrete_logs"("tenant_id", "fonte", "fonte_id");

ALTER TABLE "public"."calendario_lembrete_logs"
  ADD CONSTRAINT "calendario_lembrete_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
