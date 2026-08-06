-- CreateTable
CREATE TABLE "control_plane"."email_confirmation_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_confirmation_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_confirmation_tokens_token_hash_key" ON "control_plane"."email_confirmation_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_confirmation_tokens_user_id_idx" ON "control_plane"."email_confirmation_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_confirmation_tokens_email_idx" ON "control_plane"."email_confirmation_tokens"("email");

-- CreateIndex
CREATE INDEX "email_confirmation_tokens_expires_at_idx" ON "control_plane"."email_confirmation_tokens"("expires_at");

-- Contas já activas com password: não bloquear login após deploy.
UPDATE "public"."users"
SET "email_verified_at" = "created_at"
WHERE "email_verified_at" IS NULL
  AND "password_hash" IS NOT NULL
  AND "active" = true;
