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
    errors.push("MAIL_PROVIDER é obrigatório em produção (use brevo, smtp ou ses).");
  }
  // SMS é opcional – email + push PWA cobrem lembretes e alertas sem apps extra.
  const smsProvider = (env.SMS_PROVIDER ?? "").toLowerCase();
  if (smsProvider === "twilio") {
    requireSet(env, "TWILIO_ACCOUNT_SID", errors);
    requireSet(env, "TWILIO_AUTH_TOKEN", errors);
    requireSet(env, "TWILIO_FROM_NUMBER", errors);
  }
  assertNot(env, "STORAGE_BACKEND", ["local"], errors);
  if (!env.STORAGE_BACKEND?.trim()) {
    errors.push("STORAGE_BACKEND é obrigatório em produção (use s3).");
  }

  requireSet(env, "JWT_SECRET", errors);
  requireSet(env, "JWT_REFRESH_PEPPER", errors);
  requireSet(env, "PASSWORD_RESET_PEPPER", errors);
  requireSet(env, "PASSWORD_RESET_ENCRYPTION_KEY", errors);
  requireSet(env, "SUBSCRIPTION_KEY_PEPPER", errors);
  requireSet(env, "DATABASE_URL", errors);
  requireSet(env, "APP_PUBLIC_URL", errors);
  requireSet(env, "CORS_ORIGIN", errors);

  assertHttpsUrl(env, "APP_PUBLIC_URL", errors);
  for (const origin of (env.CORS_ORIGIN ?? "").split(",").map((o) => o.trim()).filter(Boolean)) {
    if (!origin.startsWith("https://")) {
      errors.push(`CORS_ORIGIN deve usar HTTPS em produção (recebido: ${origin}).`);
    }
  }

  if (env.COOKIE_SECURE !== "true" && env.COOKIE_SECURE !== "1") {
    errors.push("COOKIE_SECURE=true é obrigatório em produção (cookies só em HTTPS).");
  }

  if (env.TRUST_PROXY !== "true" && env.TRUST_PROXY !== "1") {
    errors.push("TRUST_PROXY=true é obrigatório em produção (TLS no reverse proxy / ALB).");
  }

  requireSet(env, "STRIPE_SECRET_KEY", errors);
  requireSet(env, "AT_CREDENTIALS_ENCRYPTION_KEY", errors);

  if (env.RLS_ENABLED !== "true") {
    errors.push("RLS_ENABLED=true é obrigatório em produção (isolamento multi-tenant na BD).");
  }

  if (env.MAIL_PROVIDER === "ses") {
    requireSet(env, "AWS_REGION", errors);
    requireSet(env, "MAIL_FROM", errors);
  }

  if (env.MAIL_PROVIDER === "smtp") {
    requireSet(env, "SMTP_HOST", errors);
    requireSet(env, "MAIL_FROM", errors);
  }

  if (env.MAIL_PROVIDER === "brevo") {
    requireSet(env, "BREVO_API_KEY", errors);
    requireSet(env, "MAIL_FROM", errors);
  }

  if (env.SMS_PROVIDER === "telegram") {
    requireSet(env, "TELEGRAM_BOT_TOKEN", errors);
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
  }
  if (sigoMode === "soap") {
    if (!env.SIGO_SOAP_ENDPOINT?.trim() && !env.SIGO_SOAP_WSDL_URL?.trim()) {
      errors.push("SIGO_SOAP_ENDPOINT ou SIGO_SOAP_WSDL_URL é obrigatório em produção (modo soap).");
    }
  }

  const cmdMode = (env.CMD_SIGNATURE_MODE ?? "disabled").toLowerCase();
  if (cmdMode === "oauth") {
    requireSet(env, "CMD_OAUTH_URL", errors);
  }

  if (env.DDOS_ENABLED === "false") {
    errors.push("DDOS_ENABLED=false não permitido em produção.");
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

function assertHttpsUrl(env: NodeJS.ProcessEnv, key: string, errors: string[]): void {
  const v = env[key]?.trim();
  if (!v) return;
  if (!v.startsWith("https://")) {
    errors.push(`${key} deve começar por https:// em produção (anti-MITM).`);
  }
}
