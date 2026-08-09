/** URL pública do logo (não exige Bearer - adequado a `<img>` e pré-visualizações). */
export function publicTenantLogoUrl(slug: string, bust?: number | string): string {
  const q = new URLSearchParams({ slug: slug.trim() });
  if (bust != null && String(bust).length) q.set("t", String(bust));
  return `/api/v1/auth/public/tenant-logo?${q.toString()}`;
}
