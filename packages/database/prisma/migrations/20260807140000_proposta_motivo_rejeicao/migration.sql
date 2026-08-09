-- Nota do cliente ao rejeitar a proposta (visível a comercial / coordenador / gestor)
ALTER TABLE "public"."propostas_comerciais"
  ADD COLUMN IF NOT EXISTS "motivo_rejeicao" TEXT;
