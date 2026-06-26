-- CreateTable
CREATE TABLE "control_plane"."auth_refresh_sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "subject_kind" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_sessions_token_hash_key" ON "control_plane"."auth_refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_refresh_sessions_subject_kind_subject_id_idx" ON "control_plane"."auth_refresh_sessions"("subject_kind", "subject_id");

-- CreateIndex
CREATE INDEX "auth_refresh_sessions_expires_at_idx" ON "control_plane"."auth_refresh_sessions"("expires_at");
