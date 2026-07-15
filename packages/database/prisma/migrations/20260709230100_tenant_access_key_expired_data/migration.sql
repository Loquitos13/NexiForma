-- Marcar chaves expiradas (requer migração separada após ADD VALUE do enum)

UPDATE "control_plane"."tenant_access_keys"
SET "status" = 'EXPIRED'
WHERE "status" = 'ACTIVE'
  AND "expires_at" IS NOT NULL
  AND "expires_at" < NOW();
