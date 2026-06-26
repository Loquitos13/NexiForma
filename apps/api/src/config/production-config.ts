/**
 * Validação de configuração para deploy em produção.
 * Rejeita modos mock/sandbox/demo e exige integrações reais quando activas.
 */
export function validateProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const errors: string[] = [];

  assertNot(env, "AT_FATURAS_MODE", ["mock", "sandbox"], errors);
  assertNot(env, "SIGO_API_MODE", ["mock"], errors);
  assertNot(env, "CMD_SIGNATURE_MODE", ["mock"], errors);
  assertNot(env, "MAIL_PROVIDER", ["log"], errors);
  if (!env.MAIL_PROVIDER?.trim()) {
    errors.push("MAIL_PROVIDER é obrigatório em produção (use ses).");
  }
  assertNot(env, "SMS_PROVIDER", ["log"], errors);
  if (!env.SMS_PROVIDER?.trim()) {
    errors.push("SMS_PROVIDER é obrigatório em produção (use twilio).");
  }
  assertNot(env, "STORAGE_BACKEND", ["local"], errors);
  if (!env.STORAGE_BACKEND?.trim()) {
    errors.push("STORAGE_BACKEND é obrigatório em produção (use s3).");
  }

  requireSet(env, "JWT_SECRET", errors);
  requireSet(env, "DATABASE_URL", errors);
  requireSet(env, "APP_PUBLIC_URL", errors);
  requireSet(env, "CORS_ORIGIN", errors);
  requireSet(env, "STRIPE_SECRET_KEY", errors);
  requireSet(env, "AT_CREDENTIALS_ENCRYPTION_KEY", errors);

  if (env.MAIL_PROVIDER === "ses") {
    requireSet(env, "AWS_REGION", errors);
    requireSet(env, "MAIL_FROM", errors);
  }

  if (env.STORAGE_BACKEND === "s3") {
    requireSet(env, "S3_BUCKET", errors);
  }

  const atMode = (env.AT_FATURAS_MODE ?? "disabled").toLowerCase();
  if (atMode === "production") {
    requireSet(env, "AT_FATURAS_PUBLIC_KEY_PATH", errors);
    requireSet(env, "AT_FATURAS_CLIENT_CERT_PFX_PATH", errors);
    requireSet(env, "AT_SOFTWARE_CERT_NUMBER", errors);
  }

  const sigoMode = (env.SIGO_API_MODE ?? "disabled").toLowerCase();
  if (sigoMode === "http") {
    requireSet(env, "SIGO_API_BASE_URL", errors);
    requireSet(env, "SIGO_API_KEY", errors);
  }

  const cmdMode = (env.CMD_SIGNATURE_MODE ?? "disabled").toLowerCase();
  if (cmdMode === "oauth") {
    requireSet(env, "CMD_OAUTH_URL", errors);
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuração de produção inválida:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    );
  }
}

function requireSet(env: NodeJS.ProcessEnv, key: string, errors: string[]): void {
  const v = env[key]?.trim();
  if (!v) errors.push(`${key} é obrigatório em produção.`);
}

function assertNot(
  env: NodeJS.ProcessEnv,
  key: string,
  forbidden: string[],
  errors: string[],
): void {
  const raw = (env[key] ?? "").toLowerCase();
  if (forbidden.includes(raw)) {
    errors.push(`${key}=${env[key]} não permitido em produção (use integração real ou disabled).`);
  }
}
