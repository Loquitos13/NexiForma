-- Validade do token QR de presença (rotação ~5 minutos).
ALTER TABLE "sessoes_formacao"
  ADD COLUMN IF NOT EXISTS "presenca_qr_expires_at" TIMESTAMP(3);
