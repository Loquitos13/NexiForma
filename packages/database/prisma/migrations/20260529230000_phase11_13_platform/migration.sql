-- Fases 11–13: quiz, UFCD, integrações, SIGO reconciliação, RGPD, documentos, avaliações

CREATE TYPE "IntegracaoProvider" AS ENUM ('ZOOM', 'TEAMS', 'MOODLE');
CREATE TYPE "IntegracaoMode" AS ENUM ('DISABLED', 'MOCK', 'OAUTH');
CREATE TYPE "SigoSubmissaoEstado" AS ENUM ('PENDENTE', 'SUBMETIDA', 'ACEITE', 'REJEITADA', 'ERRO');
CREATE TYPE "RgpdPedidoTipo" AS ENUM ('EXPORT', 'DELETE');
CREATE TYPE "RgpdPedidoEstado" AS ENUM ('PENDENTE', 'PROCESSADO', 'REJEITADO');

ALTER TABLE "public"."modulos_conteudo"
  ADD COLUMN IF NOT EXISTS "prerequisito_modulo_id" UUID,
  ADD COLUMN IF NOT EXISTS "nota_minima" INTEGER DEFAULT 60;

CREATE TABLE IF NOT EXISTS "public"."catalogo_ufcd" (
  "codigo" TEXT NOT NULL,
  "designacao" TEXT NOT NULL,
  "area" TEXT,
  "carga_horas" INTEGER,
  "nivel_qnq" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "catalogo_ufcd_pkey" PRIMARY KEY ("codigo")
);

CREATE TABLE IF NOT EXISTS "public"."tenant_integracoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "provider" "IntegracaoProvider" NOT NULL,
  "mode" "IntegracaoMode" NOT NULL DEFAULT 'DISABLED',
  "config" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_integracoes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_integracoes_tenant_id_provider_key"
  ON "public"."tenant_integracoes"("tenant_id", "provider");

CREATE TABLE IF NOT EXISTS "public"."quiz_perguntas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "modulo_id" UUID NOT NULL,
  "enunciado" TEXT NOT NULL,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "opcoes" JSONB NOT NULL,
  "pontos" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_perguntas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quiz_perguntas_tenant_modulo_idx"
  ON "public"."quiz_perguntas"("tenant_id", "modulo_id");

CREATE TABLE IF NOT EXISTS "public"."quiz_tentativas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "matricula_id" UUID NOT NULL,
  "modulo_id" UUID NOT NULL,
  "respostas" JSONB NOT NULL,
  "pontuacao" INTEGER NOT NULL,
  "aprovado" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quiz_tentativas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "quiz_tentativas_tenant_matricula_idx"
  ON "public"."quiz_tentativas"("tenant_id", "matricula_id");

CREATE TABLE IF NOT EXISTS "public"."sigo_submissoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "acao_formacao_id" UUID NOT NULL,
  "reference_id" TEXT NOT NULL,
  "estado" "SigoSubmissaoEstado" NOT NULL DEFAULT 'PENDENTE',
  "erros" JSONB,
  "payload_hash" TEXT,
  "submitted_at" TIMESTAMP(3),
  "reconciled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sigo_submissoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sigo_submissoes_tenant_acao_idx"
  ON "public"."sigo_submissoes"("tenant_id", "acao_formacao_id");

CREATE TABLE IF NOT EXISTS "public"."rgpd_pedidos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "subject_type" TEXT NOT NULL,
  "tipo" "RgpdPedidoTipo" NOT NULL,
  "estado" "RgpdPedidoEstado" NOT NULL DEFAULT 'PENDENTE',
  "resultado" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "rgpd_pedidos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "rgpd_pedidos_tenant_idx" ON "public"."rgpd_pedidos"("tenant_id");

CREATE TABLE IF NOT EXISTS "public"."documentos_anexo" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "entidade_cliente_id" UUID,
  "acao_formacao_id" UUID,
  "nome" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "tamanho_bytes" INTEGER NOT NULL,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documentos_anexo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "documentos_anexo_tenant_idx" ON "public"."documentos_anexo"("tenant_id");

CREATE TABLE IF NOT EXISTS "public"."avaliacoes_formando" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "matricula_id" UUID NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'final',
  "nota" INTEGER,
  "observacoes" TEXT,
  "avaliado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "avaliacoes_formando_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "avaliacoes_formando_tenant_matricula_idx"
  ON "public"."avaliacoes_formando"("tenant_id", "matricula_id");

ALTER TABLE "public"."tenant_integracoes"
  ADD CONSTRAINT "tenant_integracoes_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."quiz_perguntas"
  ADD CONSTRAINT "quiz_perguntas_modulo_id_fkey"
  FOREIGN KEY ("modulo_id") REFERENCES "public"."modulos_conteudo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."quiz_tentativas"
  ADD CONSTRAINT "quiz_tentativas_matricula_id_fkey"
  FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."quiz_tentativas"
  ADD CONSTRAINT "quiz_tentativas_modulo_id_fkey"
  FOREIGN KEY ("modulo_id") REFERENCES "public"."modulos_conteudo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."sigo_submissoes"
  ADD CONSTRAINT "sigo_submissoes_acao_formacao_id_fkey"
  FOREIGN KEY ("acao_formacao_id") REFERENCES "public"."acoes_formacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."documentos_anexo"
  ADD CONSTRAINT "documentos_anexo_entidade_cliente_id_fkey"
  FOREIGN KEY ("entidade_cliente_id") REFERENCES "public"."entidades_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."documentos_anexo"
  ADD CONSTRAINT "documentos_anexo_acao_formacao_id_fkey"
  FOREIGN KEY ("acao_formacao_id") REFERENCES "public"."acoes_formacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."avaliacoes_formando"
  ADD CONSTRAINT "avaliacoes_formando_matricula_id_fkey"
  FOREIGN KEY ("matricula_id") REFERENCES "public"."matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."modulos_conteudo"
  ADD CONSTRAINT "modulos_conteudo_prerequisito_modulo_id_fkey"
  FOREIGN KEY ("prerequisito_modulo_id") REFERENCES "public"."modulos_conteudo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
