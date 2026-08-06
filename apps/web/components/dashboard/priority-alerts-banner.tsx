"use client";

import Link from "next/link";
import { AlertTriangle, GraduationCap, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

export type PriorityAlerta = {
  id: string;
  tipo: string;
  severidade: "critico" | "aviso";
  codigoInterno: string;
  mensagem: string;
  accaoUrl: string;
};

function rank(a: PriorityAlerta): number {
  if (a.tipo === "inspecao" && a.severidade === "critico") return 0;
  if (a.tipo === "inspecao") return 1;
  if (a.tipo === "formador") return 2;
  if (a.severidade === "critico") return 3;
  return 4;
}

type Props = {
  alertas: PriorityAlerta[];
  className?: string;
};

/** Banner de prioridade no topo da dashboard (DGERT > formador > resto). */
export function PriorityAlertsBanner({ alertas, className }: Props) {
  const ordered = [...alertas]
    .filter((a) => a.tipo === "inspecao" || a.tipo === "formador" || a.severidade === "critico")
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 5);

  if (ordered.length === 0) return null;

  const formadorCount = ordered.filter((a) => a.tipo === "formador").length;
  const dgertCount = ordered.filter((a) => a.tipo === "inspecao").length;

  return (
    <Card
      className={cn(
        "border-amber-500/40 bg-gradient-to-r from-amber-950/50 via-slate-900/80 to-violet-950/40",
        className,
      )}
    >
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-300" />
          <h2 className="text-sm font-semibold text-slate-100">Prioridades operacionais</h2>
          {dgertCount > 0 ? (
            <Badge variant="yellow">DGERT {dgertCount}</Badge>
          ) : null}
          {formadorCount > 0 ? (
            <Badge variant="purple">{formadorCount} sem formador</Badge>
          ) : null}
        </div>
        <p className="text-xs text-slate-400">
          Com o core de formação activo, a compliance DGERT tem prioridade máxima. Sessões sem
          formador impedem o início e a operação (presenças, QR, LMS).
        </p>
        <ul className="space-y-2">
          {ordered.map((a) => {
            const Icon =
              a.tipo === "inspecao"
                ? ShieldAlert
                : a.tipo === "formador"
                  ? GraduationCap
                  : AlertTriangle;
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-start gap-2 rounded-xl border border-slate-700/40 bg-slate-950/40 px-3 py-2.5"
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    a.tipo === "formador" ? "text-violet-300" : "text-amber-300",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={a.severidade === "critico" ? "red" : "yellow"}>
                      {a.tipo === "inspecao"
                        ? "DGERT"
                        : a.tipo === "formador"
                          ? "Formador"
                          : a.severidade}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-200">{a.codigoInterno}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-400">{a.mensagem}</p>
                </div>
                <Link href={a.accaoUrl} className="shrink-0">
                  <Button size="sm" variant="secondary">
                    Resolver
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
