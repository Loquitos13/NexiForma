-- TTL em links de verificação de certificados + actor PUBLIC_LINK na auditoria global

ALTER TYPE "control_plane"."AuditActorType" ADD VALUE IF NOT EXISTS 'PUBLIC_LINK';

ALTER TABLE "public"."certificados_verificacao"
  ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "certificados_verificacao_token_expires_at_idx"
  ON "public"."certificados_verificacao"("token_expires_at");
