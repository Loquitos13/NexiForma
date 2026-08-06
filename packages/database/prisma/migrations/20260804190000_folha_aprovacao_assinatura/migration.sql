-- Nome da assinatura manuscrita do gestor ao aprovar a folha de presenças.
ALTER TABLE "public"."folhas_presenca"
  ADD COLUMN IF NOT EXISTS "aprovacao_assinatura_nome" VARCHAR(120);
