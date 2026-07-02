-- Prazo para conclusão dos conteúdos LMS na acção formativa
ALTER TABLE "public"."acoes_formacao"
  ADD COLUMN "prazo_conclusao_lms" DATE;
