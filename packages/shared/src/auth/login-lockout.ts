export type TenantLoginLockoutConfig = {
  enabled?: boolean;
  maxAttempts?: number;
  windowMinutes?: number;
  lockoutMinutes?: number;
};

export type ResolvedLoginLockoutPolicy = {
  enabled: boolean;
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
};

export type LoginLockoutDefaults = {
  enabled: boolean;
  maxAttempts: number;
  windowMinutes: number;
  lockoutMinutes: number;
};

export const LOGIN_LOCKOUT_FIELD_LIMITS = {
  maxAttempts: { min: 3, max: 20 },
  windowMinutes: { min: 1, max: 60 },
  lockoutMinutes: { min: 1, max: 1440 },
} as const;

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readOptionalInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.floor(value);
}

export function parseTenantLoginLockoutConfig(
  metadata: unknown,
): TenantLoginLockoutConfig | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).loginLockout;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const source = raw as Record<string, unknown>;
  const config: TenantLoginLockoutConfig = {};
  const enabled = readOptionalBoolean(source.enabled);
  const maxAttempts = readOptionalInt(source.maxAttempts);
  const windowMinutes = readOptionalInt(source.windowMinutes);
  const lockoutMinutes = readOptionalInt(source.lockoutMinutes);

  if (enabled !== undefined) config.enabled = enabled;
  if (maxAttempts !== undefined) config.maxAttempts = maxAttempts;
  if (windowMinutes !== undefined) config.windowMinutes = windowMinutes;
  if (lockoutMinutes !== undefined) config.lockoutMinutes = lockoutMinutes;

  return Object.keys(config).length ? config : null;
}

export function clampLoginLockoutConfig(
  config: TenantLoginLockoutConfig,
): TenantLoginLockoutConfig {
  const out: TenantLoginLockoutConfig = {};
  if (config.enabled !== undefined) out.enabled = config.enabled;
  if (config.maxAttempts !== undefined) {
    out.maxAttempts = Math.min(
      LOGIN_LOCKOUT_FIELD_LIMITS.maxAttempts.max,
      Math.max(LOGIN_LOCKOUT_FIELD_LIMITS.maxAttempts.min, config.maxAttempts),
    );
  }
  if (config.windowMinutes !== undefined) {
    out.windowMinutes = Math.min(
      LOGIN_LOCKOUT_FIELD_LIMITS.windowMinutes.max,
      Math.max(LOGIN_LOCKOUT_FIELD_LIMITS.windowMinutes.min, config.windowMinutes),
    );
  }
  if (config.lockoutMinutes !== undefined) {
    out.lockoutMinutes = Math.min(
      LOGIN_LOCKOUT_FIELD_LIMITS.lockoutMinutes.max,
      Math.max(LOGIN_LOCKOUT_FIELD_LIMITS.lockoutMinutes.min, config.lockoutMinutes),
    );
  }
  return out;
}

export function resolveLoginLockoutPolicy(
  tenantConfig: TenantLoginLockoutConfig | null | undefined,
  defaults: LoginLockoutDefaults,
): ResolvedLoginLockoutPolicy {
  const maxAttempts = tenantConfig?.maxAttempts ?? defaults.maxAttempts;
  const windowMinutes = tenantConfig?.windowMinutes ?? defaults.windowMinutes;
  const lockoutMinutes = tenantConfig?.lockoutMinutes ?? defaults.lockoutMinutes;

  return {
    enabled: tenantConfig?.enabled ?? defaults.enabled,
    maxAttempts,
    windowMs: windowMinutes * 60_000,
    lockoutMs: lockoutMinutes * 60_000,
  };
}

export function mergeTenantLoginLockoutMetadata(
  metadata: unknown,
  patch: TenantLoginLockoutConfig,
): Record<string, unknown> {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const existing = parseTenantLoginLockoutConfig(base) ?? {};
  base.loginLockout = clampLoginLockoutConfig({ ...existing, ...patch });
  return base;
}

export function resolvedPolicyToMinutes(policy: ResolvedLoginLockoutPolicy): {
  enabled: boolean;
  maxAttempts: number;
  windowMinutes: number;
  lockoutMinutes: number;
} {
  return {
    enabled: policy.enabled,
    maxAttempts: policy.maxAttempts,
    windowMinutes: Math.max(1, Math.ceil(policy.windowMs / 60_000)),
    lockoutMinutes: Math.max(1, Math.ceil(policy.lockoutMs / 60_000)),
  };
}
