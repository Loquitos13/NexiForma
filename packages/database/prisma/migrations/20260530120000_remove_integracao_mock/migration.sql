-- Repor integrações MOCK como DISABLED antes de remover o valor do enum
UPDATE "tenant_integracoes" SET "mode" = 'DISABLED' WHERE "mode" = 'MOCK';

-- Limpar salas simuladas (URLs internas /portal/demo/sala)
UPDATE "sessoes_formacao"
SET
  "sala_join_url" = NULL,
  "zoom_meeting_id" = NULL,
  "teams_meeting_id" = NULL
WHERE "sala_join_url" LIKE '/portal/demo/sala%'
   OR "zoom_meeting_id" LIKE 'zoom-demo-%'
   OR "zoom_meeting_id" LIKE 'demo-%'
   OR "teams_meeting_id" LIKE 'teams-demo-%'
   OR "teams_meeting_id" LIKE 'demo-%';

-- O default 'DISABLED'::IntegracaoMode impede o cast automático ao recriar o enum
ALTER TABLE "tenant_integracoes" ALTER COLUMN "mode" DROP DEFAULT;

ALTER TYPE "IntegracaoMode" RENAME TO "IntegracaoMode_old";
CREATE TYPE "IntegracaoMode" AS ENUM ('DISABLED', 'OAUTH');
ALTER TABLE "tenant_integracoes"
  ALTER COLUMN "mode" TYPE "IntegracaoMode"
  USING ("mode"::text::"IntegracaoMode");
ALTER TABLE "tenant_integracoes"
  ALTER COLUMN "mode" SET DEFAULT 'DISABLED'::"IntegracaoMode";
DROP TYPE "IntegracaoMode_old";
