-- App de autenticação em dois passos escolhida pelo utilizador (rótulo amigável na UI).
ALTER TABLE "public"."users" ADD COLUMN IF NOT EXISTS "mfa_app" VARCHAR(32);
