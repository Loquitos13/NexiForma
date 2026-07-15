-- Support tickets (encrypted payload) + tenant access keys + must_change_password

CREATE TYPE "control_plane"."SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "control_plane"."TenantAccessKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "control_plane"."support_tickets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ticket_ref" TEXT NOT NULL,
  "tenant_id" UUID,
  "payload_enc" TEXT NOT NULL,
  "status" "control_plane"."SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
  "resolved_at" TIMESTAMP(3),
  "resolved_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_ticket_ref_key" UNIQUE ("ticket_ref"),
  CONSTRAINT "support_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "support_tickets_status_created_at_idx" ON "control_plane"."support_tickets"("status", "created_at");
CREATE INDEX "support_tickets_tenant_id_created_at_idx" ON "control_plane"."support_tickets"("tenant_id", "created_at");

CREATE TABLE "control_plane"."tenant_access_keys" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "label" TEXT,
  "status" "control_plane"."TenantAccessKeyStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_by_id" TEXT NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_access_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_access_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "tenant_access_keys_tenant_id_status_idx" ON "control_plane"."tenant_access_keys"("tenant_id", "status");
CREATE INDEX "tenant_access_keys_key_hash_idx" ON "control_plane"."tenant_access_keys"("key_hash");

ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;
