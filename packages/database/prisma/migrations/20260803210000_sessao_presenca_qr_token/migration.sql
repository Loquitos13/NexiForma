-- Token único por sessão para check-in de presença via QR.
ALTER TABLE "public"."sessoes_formacao"
ADD COLUMN "presenca_qr_token" TEXT;

CREATE UNIQUE INDEX "sessoes_formacao_presenca_qr_token_key"
ON "public"."sessoes_formacao"("presenca_qr_token");
