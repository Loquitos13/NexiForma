import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/ui/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-slate-700 text-slate-200",
        blue: "bg-blue-900/50 text-blue-300 border border-blue-700/40",
        green: "bg-green-900/50 text-green-300 border border-green-700/40",
        yellow: "bg-yellow-900/50 text-yellow-300 border border-yellow-700/40",
        red: "bg-red-900/50 text-red-300 border border-red-700/40",
        purple: "bg-purple-900/50 text-purple-300 border border-purple-700/40",
        teal: "bg-teal-900/50 text-teal-300 border border-teal-700/40",
        orange: "bg-orange-900/50 text-orange-300 border border-orange-700/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Map estado strings to badge variants */
export function estadoBadge(estado: string): React.ReactNode {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    PLANEADA: { variant: "yellow", label: "Planeada" },
    PLANEAMENTO: { variant: "yellow", label: "Planeamento" },
    EM_CURSO: { variant: "blue", label: "Em curso" },
    CONCLUIDA: { variant: "green", label: "Concluída" },
    CANCELADA: { variant: "red", label: "Cancelada" },
    SUSPENSA: { variant: "orange", label: "Suspensa" },
    ATIVA: { variant: "green", label: "Activa" },
    INATIVA: { variant: "default", label: "Inactiva" },
    PENDENTE: { variant: "yellow", label: "Pendente" },
    APROVADO: { variant: "green", label: "Aprovado" },
    REJEITADO: { variant: "red", label: "Rejeitado" },
  };
  const entry = map[estado?.toUpperCase()];
  return entry ? (
    <Badge variant={entry.variant}>{entry.label}</Badge>
  ) : (
    <Badge>{estado}</Badge>
  );
}
