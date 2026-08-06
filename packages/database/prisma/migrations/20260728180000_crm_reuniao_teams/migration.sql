ALTER TABLE "public"."interaccoes_comerciais"
  ADD COLUMN IF NOT EXISTS "teams_meeting_id" VARCHAR(128),
  ADD COLUMN IF NOT EXISTS "sala_join_url" TEXT,
  ADD COLUMN IF NOT EXISTS "reuniao_estado" VARCHAR(16) DEFAULT 'AGENDADA',
  ADD COLUMN IF NOT EXISTS "reuniao_iniciada_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reuniao_terminada_em" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reuniao_duracao_segundos" INTEGER,
  ADD COLUMN IF NOT EXISTS "reuniao_origem_id" UUID;

ALTER TABLE "public"."interaccoes_comerciais"
  ADD CONSTRAINT "interaccoes_comerciais_reuniao_origem_id_fkey"
  FOREIGN KEY ("reuniao_origem_id") REFERENCES "public"."interaccoes_comerciais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "interaccoes_comerciais_reuniao_origem_id_idx"
  ON "public"."interaccoes_comerciais"("reuniao_origem_id");
