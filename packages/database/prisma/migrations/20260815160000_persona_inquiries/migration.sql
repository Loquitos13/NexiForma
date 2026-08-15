-- Verificações de identidade Persona (formando / formador).
CREATE TABLE "public"."persona_inquiries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_kind" TEXT NOT NULL,
  "formando_id" UUID,
  "formador_id" UUID,
  "persona_inquiry_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'created',
  "persona_status" TEXT,
  "extracted_name" TEXT,
  "extracted_doc_number" TEXT,
  "synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "persona_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "persona_inquiries_persona_inquiry_id_key"
  ON "public"."persona_inquiries"("persona_inquiry_id");

CREATE INDEX "persona_inquiries_tenant_id_user_id_idx"
  ON "public"."persona_inquiries"("tenant_id", "user_id");

CREATE INDEX "persona_inquiries_formando_id_idx"
  ON "public"."persona_inquiries"("formando_id");

CREATE INDEX "persona_inquiries_formador_id_idx"
  ON "public"."persona_inquiries"("formador_id");

ALTER TABLE "public"."persona_inquiries"
  ADD CONSTRAINT "persona_inquiries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "control_plane"."tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."persona_inquiries"
  ADD CONSTRAINT "persona_inquiries_formando_id_fkey"
  FOREIGN KEY ("formando_id") REFERENCES "public"."formandos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."persona_inquiries"
  ADD CONSTRAINT "persona_inquiries_formador_id_fkey"
  FOREIGN KEY ("formador_id") REFERENCES "public"."formadores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
