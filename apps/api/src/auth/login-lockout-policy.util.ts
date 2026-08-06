import {
  parseTenantLoginLockoutConfig,
  resolveLoginLockoutPolicy,
  type LoginLockoutDefaults,
  type ResolvedLoginLockoutPolicy,
} from "@nexiforma/shared";
import {
  loginFailLockoutMs,
  loginFailMaxAttempts,
  loginFailWindowMs,
} from "../common/ddos-throttle.config";

export function globalLoginLockoutDefaults(): LoginLockoutDefaults {
  return {
    enabled: true,
    maxAttempts: loginFailMaxAttempts(),
    windowMinutes: Math.max(1, Math.ceil(loginFailWindowMs() / 60_000)),
    lockoutMinutes: Math.max(1, Math.ceil(loginFailLockoutMs() / 60_000)),
  };
}

export function resolveTenantLoginLockoutPolicy(
  metadata: unknown,
): ResolvedLoginLockoutPolicy {
  return resolveLoginLockoutPolicy(
    parseTenantLoginLockoutConfig(metadata),
    globalLoginLockoutDefaults(),
  );
}
