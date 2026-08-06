-- Contador de presença do formador na sessão (espelha reuniaoIniciadaEm do CRM)
ALTER TABLE "public"."sessoes_formacao"
  ADD COLUMN IF NOT EXISTS "formador_entrada_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "formador_saida_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "formador_duracao_segundos" INTEGER;
