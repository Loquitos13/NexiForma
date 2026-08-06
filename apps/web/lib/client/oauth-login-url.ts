export type OAuthProviders = {
  google: boolean;
  microsoft: boolean;
  googleStartUrl: string | null;
  microsoftStartUrl: string | null;
};

export function oauthStartUrl(provider: "google" | "microsoft", slug: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  return `${base}/v1/auth/oauth/${provider}/start?slug=${encodeURIComponent(slug)}`;
}
