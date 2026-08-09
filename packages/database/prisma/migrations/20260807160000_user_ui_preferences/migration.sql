-- Preferências de UI pessoais (tema) - User (tenant) e PlatformUser
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "ui_preferences" JSONB;
ALTER TABLE "control_plane"."platform_users" ADD COLUMN IF NOT EXISTS "ui_preferences" JSONB;
