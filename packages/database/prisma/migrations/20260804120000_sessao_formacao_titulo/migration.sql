-- Nome do módulo no cronograma (import IA / grelha) para exibição na lista de sessões.
ALTER TABLE "public"."sessoes_formacao"
  ADD COLUMN IF NOT EXISTS "titulo" VARCHAR(200);
