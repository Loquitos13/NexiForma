-- CreateEnum
CREATE TYPE "control_plane"."PlatformAlertSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "control_plane"."PlatformAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "control_plane"."platform_http_alerts" (
    "id" UUID NOT NULL,
    "status_code" INTEGER NOT NULL,
    "http_method" TEXT,
    "http_path" TEXT,
    "modulo" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "corpo" TEXT,
    "stack" TEXT,
    "tenant_id" UUID,
    "tenant_slug" TEXT,
    "user_email" TEXT,
    "user_id" TEXT,
    "severity" "control_plane"."PlatformAlertSeverity" NOT NULL DEFAULT 'ERROR',
    "status" "control_plane"."PlatformAlertStatus" NOT NULL DEFAULT 'OPEN',
    "fingerprint" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_http_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "control_plane"."tenant_health_checks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portal_up" BOOLEAN NOT NULL DEFAULT true,
    "api_up" BOOLEAN NOT NULL DEFAULT true,
    "dns_ok" BOOLEAN,
    "dns_host" TEXT,
    "dns_detail" TEXT,
    "issues" JSONB,
    "activity" JSONB,

    CONSTRAINT "tenant_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_http_alerts_status_occurred_at_idx" ON "control_plane"."platform_http_alerts"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_http_alerts_tenant_id_occurred_at_idx" ON "control_plane"."platform_http_alerts"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "platform_http_alerts_status_code_idx" ON "control_plane"."platform_http_alerts"("status_code");

-- CreateIndex
CREATE INDEX "platform_http_alerts_fingerprint_idx" ON "control_plane"."platform_http_alerts"("fingerprint");

-- CreateIndex
CREATE INDEX "tenant_health_checks_tenant_id_checked_at_idx" ON "control_plane"."tenant_health_checks"("tenant_id", "checked_at");

-- AddForeignKey
ALTER TABLE "control_plane"."platform_http_alerts" ADD CONSTRAINT "platform_http_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_plane"."tenant_health_checks" ADD CONSTRAINT "tenant_health_checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
