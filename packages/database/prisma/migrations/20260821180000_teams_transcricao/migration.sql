-- Transcrição automática de reuniões Teams (Graph API)
ALTER TABLE "interaccoes_comerciais"
  ADD COLUMN IF NOT EXISTS "teams_transcricao" TEXT,
  ADD COLUMN IF NOT EXISTS "teams_transcricao_estado" VARCHAR(16);

ALTER TABLE "sessoes_formacao"
  ADD COLUMN IF NOT EXISTS "teams_transcricao" TEXT,
  ADD COLUMN IF NOT EXISTS "teams_transcricao_estado" VARCHAR(16);

CREATE INDEX IF NOT EXISTS "interaccoes_comerciais_teams_transcricao_pendente_idx"
  ON "interaccoes_comerciais" ("tenant_id", "teams_transcricao_estado")
  WHERE "teams_transcricao_estado" = 'PENDENTE';

CREATE INDEX IF NOT EXISTS "sessoes_formacao_teams_transcricao_pendente_idx"
  ON "sessoes_formacao" ("tenant_id", "teams_transcricao_estado")
  WHERE "teams_transcricao_estado" = 'PENDENTE';
