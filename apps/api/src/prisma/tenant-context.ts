import { AsyncLocalStorage } from "node:async_hooks";

export type TenantDbContext = {
  tenantId: string | null;
  bypassRls: boolean;
};

export const tenantDbStorage = new AsyncLocalStorage<TenantDbContext>();

export function getTenantDbContext(): TenantDbContext {
  return tenantDbStorage.getStore() ?? { tenantId: null, bypassRls: true };
}

export async function runWithTenantContext<T>(
  ctx: TenantDbContext,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantDbStorage.run(ctx, fn);
}
