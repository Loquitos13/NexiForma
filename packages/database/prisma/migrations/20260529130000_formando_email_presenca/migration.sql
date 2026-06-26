-- Email obrigatório na reunião Zoom/Teams (configurável pelo gestor; fallback = conta do tenant)
ALTER TABLE "public"."formandos" ADD COLUMN "email_presenca" TEXT;

CREATE INDEX "formandos_tenant_id_email_presenca_idx" ON "public"."formandos"("tenant_id", "email_presenca");
