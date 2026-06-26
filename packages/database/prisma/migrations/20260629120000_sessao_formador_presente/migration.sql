-- Presença do formador na sessão (marcada ao iniciar ou manualmente)
ALTER TABLE "public"."sessoes_formacao"
ADD COLUMN IF NOT EXISTS "formador_presente" BOOLEAN;
