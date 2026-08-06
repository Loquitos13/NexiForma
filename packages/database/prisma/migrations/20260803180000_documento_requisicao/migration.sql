-- Pedidos de «outros documentos» do gestor ao formando

CREATE TABLE IF NOT EXISTS "documento_requisicoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT,
  "formando_id" UUID NOT NULL,
  "matricula_id" UUID,
  "acao_formacao_id" UUID,
  "estado" TEXT NOT NULL DEFAULT 'pendente',
  "documento_anexo_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submetido_em" TIMESTAMP(3),
  CONSTRAINT "documento_requisicoes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "documento_requisicoes_tenant_id_idx"
  ON "documento_requisicoes"("tenant_id");

CREATE INDEX IF NOT EXISTS "documento_requisicoes_formando_id_estado_idx"
  ON "documento_requisicoes"("formando_id", "estado");

CREATE INDEX IF NOT EXISTS "documento_requisicoes_acao_formacao_id_idx"
  ON "documento_requisicoes"("acao_formacao_id");

DO $$ BEGIN
  ALTER TABLE "documento_requisicoes"
    ADD CONSTRAINT "documento_requisicoes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "documento_requisicoes"
    ADD CONSTRAINT "documento_requisicoes_formando_id_fkey"
    FOREIGN KEY ("formando_id") REFERENCES "formandos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "documento_requisicoes"
    ADD CONSTRAINT "documento_requisicoes_acao_formacao_id_fkey"
    FOREIGN KEY ("acao_formacao_id") REFERENCES "acoes_formacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "documento_requisicoes"
    ADD CONSTRAINT "documento_requisicoes_documento_anexo_id_fkey"
    FOREIGN KEY ("documento_anexo_id") REFERENCES "documentos_anexo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.documento_requisicoes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.documento_requisicoes FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON public.documento_requisicoes;
  CREATE POLICY tenant_isolation ON public.documento_requisicoes
    FOR ALL TO app_tenant
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN undefined_function THEN NULL;
END $$;
