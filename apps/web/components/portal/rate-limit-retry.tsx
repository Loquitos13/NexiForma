"use client";

import { bo } from "@/lib/ui/backoffice";

type Props = {
  message: string;
  remainingSec: number;
  onRetry: () => void;
  retrying?: boolean;
};

export function RateLimitRetryBanner({ message, remainingSec, onRetry, retrying }: Props) {
  const disabled = remainingSec > 0 || retrying;
  const label =
    remainingSec > 0
      ? `Tentar novamente (${remainingSec}s)`
      : retrying
        ? "A tentar…"
        : "Tentar novamente";

  return (
    <div
      style={{
        ...bo.card,
        border: "1px solid rgba(248,113,113,0.35)",
        marginBottom: "1rem",
      }}
    >
      <p style={{ ...bo.alert, margin: "0 0 0.75rem" }}>{message}</p>
      <button
        type="button"
        style={disabled ? { ...bo.btnSecondary, opacity: 0.65, cursor: "not-allowed" } : bo.btnTeal}
        disabled={disabled}
        onClick={onRetry}
      >
        {label}
      </button>
    </div>
  );
}
