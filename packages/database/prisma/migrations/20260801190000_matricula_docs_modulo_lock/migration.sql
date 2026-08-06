-- Documentos por matrícula + lock manual por módulo (desbloqueio por formando)

ALTER TABLE "documentos_anexo"
  ADD COLUMN IF NOT EXISTS "matricula_id" UUID;

DO $$ BEGIN
  ALTER TABLE "documentos_anexo"
    ADD CONSTRAINT "documentos_anexo_matricula_id_fkey"
    FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "documentos_anexo_matricula_id_idx"
  ON "documentos_anexo"("matricula_id");

ALTER TABLE "modulos_unidade"
  ADD COLUMN IF NOT EXISTS "lock_manual" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "matricula_documentos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "matricula_id" UUID NOT NULL,
  "categoria" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'pendente',
  "documento_anexo_id" UUID,
  "aceite_em" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matricula_documentos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "matricula_documentos_matricula_id_categoria_key"
  ON "matricula_documentos"("matricula_id", "categoria");

CREATE INDEX IF NOT EXISTS "matricula_documentos_tenant_id_idx"
  ON "matricula_documentos"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "matricula_documentos"
    ADD CONSTRAINT "matricula_documentos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "matricula_documentos"
    ADD CONSTRAINT "matricula_documentos_matricula_id_fkey"
    FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "matricula_documentos"
    ADD CONSTRAINT "matricula_documentos_documento_anexo_id_fkey"
    FOREIGN KEY ("documento_anexo_id") REFERENCES "documentos_anexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "matricula_unidade_desbloqueios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "matricula_id" UUID NOT NULL,
  "modulo_unidade_id" UUID NOT NULL,
  "desbloqueado_por_user_id" UUID,
  "desbloqueado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "motivo" TEXT,
  CONSTRAINT "matricula_unidade_desbloqueios_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "matricula_unidade_desbloqueios_matricula_unidade_key"
  ON "matricula_unidade_desbloqueios"("matricula_id", "modulo_unidade_id");

CREATE INDEX IF NOT EXISTS "matricula_unidade_desbloqueios_tenant_id_idx"
  ON "matricula_unidade_desbloqueios"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "matricula_unidade_desbloqueios"
    ADD CONSTRAINT "matricula_unidade_desbloqueios_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "matricula_unidade_desbloqueios"
    ADD CONSTRAINT "matricula_unidade_desbloqueios_matricula_id_fkey"
    FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "matricula_unidade_desbloqueios"
    ADD CONSTRAINT "matricula_unidade_desbloqueios_modulo_unidade_id_fkey"
    FOREIGN KEY ("modulo_unidade_id") REFERENCES "modulos_unidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS para tabelas novas (padrão tenant_isolation)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['matricula_documentos', 'matricula_unidade_desbloqueios']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I FOR ALL TO app_tenant '
      || 'USING (tenant_id = public.current_tenant_id()) '
      || 'WITH CHECK (tenant_id = public.current_tenant_id())',
      t
    );
  END LOOP;
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.matricula_documentos TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.matricula_unidade_desbloqueios TO app_tenant;

-- Backfill checklist para matrículas existentes
INSERT INTO public.matricula_documentos (id, tenant_id, matricula_id, categoria, estado, created_at, updated_at)
SELECT gen_random_uuid(), m.tenant_id, m.id, c.categoria, 'pendente', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM public.matriculas m
CROSS JOIN (
  VALUES
    ('declaracao_inscricao'),
    ('contrato_formacao'),
    ('regulamento_formacao')
) AS c(categoria)
ON CONFLICT (matricula_id, categoria) DO NOTHING;
