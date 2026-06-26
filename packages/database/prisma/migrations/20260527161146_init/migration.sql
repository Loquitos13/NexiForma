-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "control_plane";

-- CreateEnum
CREATE TYPE "control_plane"."ControlTenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "control_plane"."SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'PAUSED');

-- CreateEnum
CREATE TYPE "control_plane"."InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "control_plane"."SubscriptionKeyStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED');

-- CreateEnum
CREATE TYPE "control_plane"."AuditActorType" AS ENUM ('SUPERADMIN_USER', 'SYSTEM', 'TENANT_USER');

-- CreateEnum
CREATE TYPE "TenantUserRole" AS ENUM ('ADMIN', 'COORDENADOR', 'FORMADOR', 'FORMANDO', 'FINANCEIRO');

-- CreateEnum
CREATE TYPE "AcaoEstado" AS ENUM ('PLANEADA', 'EM_CURSO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MatriculaEstado" AS ENUM ('ATIVA', 'DESISTENCIA', 'CONCLUSAO');

-- CreateEnum
CREATE TYPE "SessaoEstado" AS ENUM ('AGENDADA', 'REALIZADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "control_plane"."tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "status" "control_plane"."ControlTenantStatus" NOT NULL DEFAULT 'TRIAL',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plane"."subscription_plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents_monthly" INTEGER NOT NULL,
    "max_active_users" INTEGER,
    "features" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plane"."tenant_subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "control_plane"."SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "billing_email" TEXT,
    "external_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plane"."subscription_invoices" (
    "id" UUID NOT NULL,
    "tenant_subscription_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "control_plane"."InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paid_at" TIMESTAMP(3),
    "external_invoice_id" TEXT,
    "payment_method_last4" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plane"."tenant_subscription_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "status" "control_plane"."SubscriptionKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "max_active_users_snapshot" INTEGER,
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_subscription_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plane"."global_audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "control_plane"."AuditActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_ip" INET,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "target_tenant_id" UUID,
    "target_user_id" UUID,
    "payload" JSONB,
    "prev_hash" BYTEA,

    CONSTRAINT "global_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plane"."impersonation_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "super_admin_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "jwt_jti" TEXT NOT NULL,
    "read_only" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audit_log_id" BIGINT,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "TenantUserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cognito_sub" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entidades_cliente" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nif" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entidades_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formandos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "entidade_cliente_id" UUID,
    "nome" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formandos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formadores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nome_completo" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cc_numero" TEXT,
    "ccp_numero" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cursos" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "codigo_ufcd" TEXT,
    "designacao" TEXT NOT NULL,
    "carga_horas" INTEGER NOT NULL,
    "modalidade" TEXT NOT NULL,
    "objetivos" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acoes_formacao" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "curso_id" UUID NOT NULL,
    "codigo_interno" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE NOT NULL,
    "estado" "AcaoEstado" NOT NULL DEFAULT 'PLANEADA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acoes_formacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "acao_formacao_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "formando_id" UUID NOT NULL,
    "estado" "MatriculaEstado" NOT NULL DEFAULT 'ATIVA',
    "data_inscricao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cronogramas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "acao_formacao_id" UUID NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "aprovado_por" UUID,
    "aprovado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cronogramas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_formacao" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cronograma_id" UUID NOT NULL,
    "numero_sessao" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fim" TEXT NOT NULL,
    "modalidade" TEXT NOT NULL,
    "estado" "SessaoEstado" NOT NULL DEFAULT 'AGENDADA',
    "formador_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_formacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sumarios" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "conteudo" TEXT NOT NULL,
    "assinatura_ref" TEXT,
    "assinado_em" TIMESTAMP(3),
    "imutavel" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sumarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folhas_presenca" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "fechada_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folhas_presenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "folha_presenca_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "presente" BOOLEAN NOT NULL DEFAULT false,
    "minutos_efetivos" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presencas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acesso_lms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "matricula_id" UUID NOT NULL,
    "sessao_formacao_id" UUID,
    "evento" TEXT NOT NULL,
    "duracao_segundos" INTEGER,
    "ocorrido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "acesso_lms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "control_plane"."tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_nif_key" ON "control_plane"."tenants"("nif");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "control_plane"."subscription_plans"("code");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_tenant_id_idx" ON "control_plane"."tenant_subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_subscriptions_status_idx" ON "control_plane"."tenant_subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscription_invoices_tenant_subscription_id_idx" ON "control_plane"."subscription_invoices"("tenant_subscription_id");

-- CreateIndex
CREATE INDEX "tenant_subscription_keys_tenant_id_status_idx" ON "control_plane"."tenant_subscription_keys"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "global_audit_logs_occurred_at_idx" ON "control_plane"."global_audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "global_audit_logs_target_tenant_id_idx" ON "control_plane"."global_audit_logs"("target_tenant_id");

-- CreateIndex
CREATE INDEX "global_audit_logs_action_idx" ON "control_plane"."global_audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "impersonation_sessions_jwt_jti_key" ON "control_plane"."impersonation_sessions"("jwt_jti");

-- CreateIndex
CREATE INDEX "impersonation_sessions_tenant_id_created_at_idx" ON "control_plane"."impersonation_sessions"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_cognito_sub_key" ON "users"("cognito_sub");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "entidades_cliente_tenant_id_idx" ON "entidades_cliente"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "entidades_cliente_tenant_id_nif_key" ON "entidades_cliente"("tenant_id", "nif");

-- CreateIndex
CREATE UNIQUE INDEX "formandos_user_id_key" ON "formandos"("user_id");

-- CreateIndex
CREATE INDEX "formandos_tenant_id_idx" ON "formandos"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "formandos_tenant_id_nif_key" ON "formandos"("tenant_id", "nif");

-- CreateIndex
CREATE UNIQUE INDEX "formadores_user_id_key" ON "formadores"("user_id");

-- CreateIndex
CREATE INDEX "formadores_tenant_id_idx" ON "formadores"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "formadores_tenant_id_nif_key" ON "formadores"("tenant_id", "nif");

-- CreateIndex
CREATE INDEX "cursos_tenant_id_idx" ON "cursos"("tenant_id");

-- CreateIndex
CREATE INDEX "acoes_formacao_tenant_id_idx" ON "acoes_formacao"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "acoes_formacao_tenant_id_codigo_interno_key" ON "acoes_formacao"("tenant_id", "codigo_interno");

-- CreateIndex
CREATE INDEX "turmas_tenant_id_idx" ON "turmas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_tenant_id_acao_formacao_id_codigo_key" ON "turmas"("tenant_id", "acao_formacao_id", "codigo");

-- CreateIndex
CREATE INDEX "matriculas_tenant_id_idx" ON "matriculas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_turma_id_formando_id_key" ON "matriculas"("turma_id", "formando_id");

-- CreateIndex
CREATE INDEX "cronogramas_tenant_id_idx" ON "cronogramas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cronogramas_tenant_id_acao_formacao_id_versao_key" ON "cronogramas"("tenant_id", "acao_formacao_id", "versao");

-- CreateIndex
CREATE INDEX "sessoes_formacao_tenant_id_idx" ON "sessoes_formacao"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_formacao_cronograma_id_numero_sessao_key" ON "sessoes_formacao"("cronograma_id", "numero_sessao");

-- CreateIndex
CREATE INDEX "sumarios_tenant_id_sessao_id_idx" ON "sumarios"("tenant_id", "sessao_id");

-- CreateIndex
CREATE INDEX "folhas_presenca_tenant_id_sessao_id_idx" ON "folhas_presenca"("tenant_id", "sessao_id");

-- CreateIndex
CREATE INDEX "presencas_tenant_id_idx" ON "presencas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "presencas_folha_presenca_id_matricula_id_key" ON "presencas"("folha_presenca_id", "matricula_id");

-- CreateIndex
CREATE INDEX "acesso_lms_tenant_id_matricula_id_ocorrido_em_idx" ON "acesso_lms"("tenant_id", "matricula_id", "ocorrido_em");

-- AddForeignKey
ALTER TABLE "control_plane"."tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plane"."tenant_subscriptions" ADD CONSTRAINT "tenant_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "control_plane"."subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plane"."subscription_invoices" ADD CONSTRAINT "subscription_invoices_tenant_subscription_id_fkey" FOREIGN KEY ("tenant_subscription_id") REFERENCES "control_plane"."tenant_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plane"."tenant_subscription_keys" ADD CONSTRAINT "tenant_subscription_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plane"."impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plane"."impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plane"."impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "control_plane"."global_audit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entidades_cliente" ADD CONSTRAINT "entidades_cliente_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formandos" ADD CONSTRAINT "formandos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formandos" ADD CONSTRAINT "formandos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formandos" ADD CONSTRAINT "formandos_entidade_cliente_id_fkey" FOREIGN KEY ("entidade_cliente_id") REFERENCES "entidades_cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formadores" ADD CONSTRAINT "formadores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "formadores" ADD CONSTRAINT "formadores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cursos" ADD CONSTRAINT "cursos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_formacao" ADD CONSTRAINT "acoes_formacao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acoes_formacao" ADD CONSTRAINT "acoes_formacao_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_acao_formacao_id_fkey" FOREIGN KEY ("acao_formacao_id") REFERENCES "acoes_formacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_formando_id_fkey" FOREIGN KEY ("formando_id") REFERENCES "formandos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronogramas" ADD CONSTRAINT "cronogramas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cronogramas" ADD CONSTRAINT "cronogramas_acao_formacao_id_fkey" FOREIGN KEY ("acao_formacao_id") REFERENCES "acoes_formacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_formacao" ADD CONSTRAINT "sessoes_formacao_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_formacao" ADD CONSTRAINT "sessoes_formacao_cronograma_id_fkey" FOREIGN KEY ("cronograma_id") REFERENCES "cronogramas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_formacao" ADD CONSTRAINT "sessoes_formacao_formador_id_fkey" FOREIGN KEY ("formador_id") REFERENCES "formadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios" ADD CONSTRAINT "sumarios_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sumarios" ADD CONSTRAINT "sumarios_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes_formacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folhas_presenca" ADD CONSTRAINT "folhas_presenca_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folhas_presenca" ADD CONSTRAINT "folhas_presenca_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes_formacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_folha_presenca_id_fkey" FOREIGN KEY ("folha_presenca_id") REFERENCES "folhas_presenca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_lms" ADD CONSTRAINT "acesso_lms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_lms" ADD CONSTRAINT "acesso_lms_matricula_id_fkey" FOREIGN KEY ("matricula_id") REFERENCES "matriculas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acesso_lms" ADD CONSTRAINT "acesso_lms_sessao_formacao_id_fkey" FOREIGN KEY ("sessao_formacao_id") REFERENCES "sessoes_formacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
