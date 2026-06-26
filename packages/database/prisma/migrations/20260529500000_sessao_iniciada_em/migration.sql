-- Marca quando a sessão foi iniciada (dispara notificações uma vez)
ALTER TABLE "public"."sessoes_formacao" ADD COLUMN "iniciada_em" TIMESTAMP(3);
