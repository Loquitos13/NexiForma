-- Assinatura manuscrita do formador ao validar a folha de presenças
ALTER TABLE "public"."folhas_presenca"
ADD COLUMN IF NOT EXISTS "validacao_formador_assinatura_nome" VARCHAR(120);
