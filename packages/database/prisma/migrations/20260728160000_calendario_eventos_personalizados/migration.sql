CREATE TYPE "public"."CalendarioEventoTipo" AS ENUM ('LEMBRETE', 'EVENTO');

CREATE TABLE "public"."calendario_eventos" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "tipo" "public"."CalendarioEventoTipo" NOT NULL,
  "titulo" VARCHAR(300) NOT NULL,
  "descricao" TEXT,
  "inicio" TIMESTAMP(3) NOT NULL,
  "fim" TIMESTAMP(3),
  "criado_por_user_id" UUID NOT NULL,
  "alvo_user_ids" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calendario_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendario_eventos_tenant_id_inicio_idx"
  ON "public"."calendario_eventos"("tenant_id", "inicio");

CREATE INDEX "calendario_eventos_criado_por_user_id_idx"
  ON "public"."calendario_eventos"("criado_por_user_id");

ALTER TABLE "public"."calendario_eventos"
  ADD CONSTRAINT "calendario_eventos_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."calendario_eventos"
  ADD CONSTRAINT "calendario_eventos_criado_por_user_id_fkey"
  FOREIGN KEY ("criado_por_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
