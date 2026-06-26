import type { CSSProperties, ReactNode } from "react";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { bo } from "@/lib/ui/backoffice";

type PageShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function PageShell({ title, subtitle, children, actions }: PageShellProps) {
  return (
    <main style={bo.main}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          <h1 style={bo.h1}>{title}</h1>
          {subtitle ? <p style={bo.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{actions}</div> : null}
      </div>
      {children}
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  color?: string;
};

export function StatCard({ label, value, hint, color = "#93c5fd" }: StatCardProps) {
  return (
    <div style={{ ...bo.card, marginBottom: 0, flex: "1 1 160px", minWidth: 160 }}>
      <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.35rem" }}>{label}</div>
      <div style={{ fontSize: "1.65rem", fontWeight: 700, color }}>{value}</div>
      {hint ? <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>{hint}</div> : null}
    </div>
  );
}

export function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span style={bo.badge(color)}>{label}</span>;
}

export function LoadingBlock() {
  return <PageContentSkeleton variant="default" />;
}

export function EmptyState({ message }: { message: string }) {
  return <p style={{ color: "#64748b", fontSize: "0.9rem" }}>{message}</p>;
}

export function gridStats(): CSSProperties {
  return { display: "flex", gap: "0.85rem", flexWrap: "wrap", marginBottom: "1.25rem" };
}
