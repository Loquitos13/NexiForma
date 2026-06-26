-- Remove Autenticação.Gov (serviço AMA pago) - identificação via upload de documentos

DELETE FROM "public"."tenant_integracoes" WHERE "provider" = 'AUTENTICACAO_GOV';

ALTER TABLE "public"."formandos"
  DROP COLUMN IF EXISTS "gov_auth_verified_at",
  DROP COLUMN IF EXISTS "gov_auth_attributes";

ALTER TYPE "public"."IntegracaoProvider" RENAME TO "IntegracaoProvider_old";

CREATE TYPE "public"."IntegracaoProvider" AS ENUM ('ZOOM', 'TEAMS', 'MOODLE');

ALTER TABLE "public"."tenant_integracoes"
  ALTER COLUMN "provider" TYPE "public"."IntegracaoProvider"
  USING ("provider"::text::"public"."IntegracaoProvider");

DROP TYPE "public"."IntegracaoProvider_old";
