import type { CSSProperties } from "react";

// Re-export from new nav-items module for backward compat
export { NAV_ITEMS } from "./nav-items";

export const bo = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "var(--bg, #0f172a)",
  } satisfies CSSProperties,
  sidebar: {
    width: 240,
    flexShrink: 0,
    padding: "1.25rem 0.85rem",
    borderRight: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.92)",
  } satisfies CSSProperties,
  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: "100%",
    padding: "1.5rem 1.35rem 3rem",
  } satisfies CSSProperties,
  brand: {
    fontSize: "1.05rem",
    fontWeight: 700,
    color: "#f1f5f9",
    marginBottom: "0.25rem",
    padding: "0 0.5rem",
  } satisfies CSSProperties,
  brandSub: {
    fontSize: "0.75rem",
    color: "#64748b",
    marginBottom: "1.25rem",
    padding: "0 0.5rem",
  } satisfies CSSProperties,
  navLink: {
    display: "block",
    padding: "0.45rem 0.55rem",
    borderRadius: 8,
    color: "#cbd5e1",
    textDecoration: "none",
    fontSize: "0.88rem",
    marginBottom: "0.15rem",
  } satisfies CSSProperties,
  navLinkActive: {
    background: "rgba(37,99,235,0.22)",
    color: "#93c5fd",
    fontWeight: 600,
  } satisfies CSSProperties,
  h1: {
    fontSize: "1.55rem",
    fontWeight: 700,
    color: "#f1f5f9",
    margin: "0 0 0.35rem",
  } satisfies CSSProperties,
  subtitle: {
    color: "#94a3b8",
    fontSize: "0.92rem",
    marginBottom: "1.25rem",
  } satisfies CSSProperties,
  card: {
    padding: "1.1rem 1.25rem",
    borderRadius: 12,
    background: "rgba(15,23,42,0.65)",
    border: "1px solid rgba(148,163,184,0.22)",
    marginBottom: "1rem",
    minWidth: 0,
    maxWidth: "100%",
    overflowWrap: "anywhere" as const,
  } satisfies CSSProperties,
  h2: {
    margin: "0 0 0.65rem",
    fontSize: "1.02rem",
    fontWeight: 600,
    color: "#f1f5f9",
  } satisfies CSSProperties,
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.88rem",
  },
  th: {
    textAlign: "left" as const,
    padding: "0.45rem 0.5rem",
    color: "#94a3b8",
    borderBottom: "1px solid rgba(148,163,184,0.2)",
    fontWeight: 600,
  },
  td: {
    padding: "0.55rem 0.5rem",
    color: "#e2e8f0",
    borderBottom: "1px solid rgba(148,163,184,0.1)",
  },
  label: {
    display: "grid",
    gap: "0.35rem",
    color: "#cbd5e1",
    fontSize: "0.85rem",
  } satisfies CSSProperties,
  input: {
    padding: "0.5rem 0.6rem",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.85)",
    color: "#f1f5f9",
  } satisfies CSSProperties,
  btn: {
    padding: "0.48rem 0.85rem",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.88rem",
  } satisfies CSSProperties,
  btnSecondary: {
    padding: "0.48rem 0.85rem",
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "transparent",
    color: "#cbd5e1",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.88rem",
    textDecoration: "none",
    display: "inline-block",
  } satisfies CSSProperties,
  btnTeal: {
    padding: "0.48rem 0.85rem",
    borderRadius: 8,
    border: "none",
    background: "#0d9488",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "0.88rem",
  } satisfies CSSProperties,
  alert: {
    color: "#fca5a5",
    marginBottom: "0.75rem",
  } satisfies CSSProperties,
  ok: {
    color: "#86efac",
    marginBottom: "0.75rem",
  } satisfies CSSProperties,
  badge: (color: string): CSSProperties => ({
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: 6,
    fontSize: "0.75rem",
    fontWeight: 600,
    background: `${color}22`,
    color,
  }),
  scoreColor: (pct: number) =>
    pct >= 85 ? "#4ade80" : pct >= 50 ? "#fbbf24" : "#f87171",
};

export async function parseApiError(res: Response): Promise<string> {
  const d = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (Array.isArray(d?.message)) return d.message.join(", ");
  if (typeof d?.message === "string") return d.message;
  return `HTTP ${res.status}`;
}

// NAV_ITEMS is now exported from nav-items.ts (re-exported above)
