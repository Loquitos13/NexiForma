import type { CSSProperties } from "react";
import { APP_NAME } from "@nexiforma/shared";

export const site = {
  name: APP_NAME,
  tagline: "Gestão formativa certificada para entidades DGERT",
  colors: {
    brand: "#2563eb",
    brandLight: "#93c5fd",
    accent: "#0d9488",
    platform: "#7c3aed",
    muted: "#94a3b8",
    text: "#e2e8f0",
    surface: "rgba(15,23,42,0.72)",
    border: "rgba(148,163,184,0.22)",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    padding: "0.7rem 1.35rem",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.95rem",
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: "0 4px 24px rgba(37,99,235,0.35)",
  } satisfies CSSProperties,
  btnSecondary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.7rem 1.25rem",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.5)",
    color: "#e2e8f0",
    fontWeight: 600,
    fontSize: "0.95rem",
    textDecoration: "none",
    cursor: "pointer",
  } satisfies CSSProperties,
  btnPlatform: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0.7rem 1.35rem",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "0.95rem",
    textDecoration: "none",
    cursor: "pointer",
  } satisfies CSSProperties,
  input: {
    width: "100%",
    padding: "0.65rem 0.75rem",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(15,23,42,0.85)",
    color: "#f1f5f9",
    fontSize: "0.95rem",
    outline: "none",
  } satisfies CSSProperties,
  label: {
    display: "grid",
    gap: "0.4rem",
    color: "#cbd5e1",
    fontSize: "0.88rem",
    fontWeight: 500,
  } satisfies CSSProperties,
  error: {
    margin: 0,
    padding: "0.65rem 0.85rem",
    borderRadius: 8,
    background: "rgba(127,29,29,0.35)",
    border: "1px solid rgba(248,113,113,0.4)",
    color: "#fca5a5",
    fontSize: "0.88rem",
  } satisfies CSSProperties,
} as const;

export const FEATURES = [
  {
    title: "Dossiê pedagógico digital",
    body: "Checklist DGERT, sumários assinados, exports SIGO e arquivo auditável em S3.",
    icon: "📋",
  },
  {
    title: "LMS e assiduidade",
    body: "Conteúdos SCORM, presenças automáticas via Zoom/Teams e portal do formando.",
    icon: "🎓",
  },
  {
    title: "Multi-tenant SaaS",
    body: "Control Plane para operação, billing Stripe, MFA e isolamento por entidade formadora.",
    icon: "🏢",
  },
] as const;

export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}
