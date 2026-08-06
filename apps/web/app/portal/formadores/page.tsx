"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, GraduationCap, Pencil, ShieldAlert, UserRound } from "lucide-react";
import { DgertRequisitoBanner, DgertTarget } from "@/components/portal/dgert-requisito-banner";
import { bffFetch } from "@/lib/client/bff-fetch";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  PageHeader,
  type Column,
} from "@/components/ui";
import { credencialStatus, fmtDate } from "@/lib/crm/shared";
import { cn } from "@/lib/ui/cn";

type Formador = {
  id: string;
  nomeCompleto: string;
  nif: string;
  email: string;
  emailPresenca?: string | null;
  telefone?: string | null;
  morada?: string | null;
  ccNumero: string | null;
  ccpNumero: string | null;
  ccValidade: string | null;
  ccpValidade: string | null;
  _count?: { sessoesFormacao: number; documentos?: number };
};

type Alerta = {
  id: string;
  nomeCompleto: string;
  tipo: "cc" | "ccp";
  validade: string;
  diasRestantes: number;
  severidade: "critico" | "aviso";
};

function CredencialBadge({ validade }: { validade: string | null }) {
  const status = credencialStatus(validade);
  const variants = {
    ok: { variant: "green" as const, label: fmtDate(validade) },
    aviso: { variant: "yellow" as const, label: `Expira ${fmtDate(validade)}` },
    critico: { variant: "red" as const, label: validade ? `Expirado ${fmtDate(validade)}` : "Expirado" },
    ausente: { variant: "default" as const, label: "Não registado" },
  };
  const v = variants[status];
  return <Badge variant={v.variant}>{v.label}</Badge>;
}

export default function FormadoresPage() {
  const router = useRouter();
  const { canManageFormacao: canManage } = useTenantRole();
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, aRes] = await Promise.all([
      bffFetch("/api/v1/formadores", { headers: { accept: "application/json" } }),
      bffFetch("/api/v1/formadores/alertas-cc", { headers: { accept: "application/json" } }),
    ]);
    if (!fRes.ok) setError(await parseApiError(fRes));
    else setFormadores((await fRes.json()) as Formador[]);
    if (aRes.ok) {
      const data = (await aRes.json()) as { alertas: Alerta[] };
      setAlertas(data.alertas ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const COLS: Column<Formador>[] = [
    {
      key: "nomeCompleto",
      header: "Formador",
      cell: (f) => (
        <div>
          <span className="font-medium text-slate-100">{f.nomeCompleto}</span>
          <p className="text-xs text-slate-500 mt-0.5">
            NIF {f.nif} · {f.email}
          </p>
        </div>
      ),
    },
    {
      key: "ccNumero",
      header: "Carta de Condução",
      cell: (f) => (
        <div className="text-sm space-y-1">
          <p className="text-slate-400">{f.ccNumero ?? "-"}</p>
          <CredencialBadge validade={f.ccValidade} />
        </div>
      ),
    },
    {
      key: "ccpNumero",
      header: "CCP",
      cell: (f) => (
        <div className="text-sm space-y-1">
          <p className="text-slate-400">{f.ccpNumero ?? "-"}</p>
          <CredencialBadge validade={f.ccpValidade} />
        </div>
      ),
    },
    {
      key: "sessoes",
      header: "Sessões",
      cell: (f) => <span className="text-slate-300">{f._count?.sessoesFormacao ?? 0}</span>,
    },
    {
      key: "documentos",
      header: "Docs",
      cell: (f) => <Badge variant="default">{f._count?.documentos ?? 0}</Badge>,
    },
  ];

  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  return (
    <>
      <PageHeader
        title="Formadores"
        description="Perfil, contacto e documentos dos formadores - CC/CCP e ficheiros para DGERT."
      />

      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      <DgertRequisitoBanner backHref="/portal/dossie" />

      {alertas.length > 0 && (
        <Card className="mb-6 border-yellow-700/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {criticos > 0 ? (
                <ShieldAlert className="h-4 w-4 text-red-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-400" />
              )}
              Alertas de renovação
              <Badge variant={criticos > 0 ? "red" : "yellow"}>{alertas.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {alertas.map((a) => (
                <li
                  key={`${a.id}-${a.tipo}`}
                  className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    <GraduationCap className="inline h-3.5 w-3.5 mr-1.5 text-slate-500" />
                    {a.nomeCompleto}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severidade === "critico" ? "red" : "yellow"}>
                      {a.tipo.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {a.diasRestantes < 0
                        ? "Expirado"
                        : `${a.diasRestantes} dias · ${a.validade}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <DgertTarget id="formadores_lista">
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={COLS}
              data={formadores}
              keyField="id"
              loading={loading}
              emptyMessage="Sem formadores registados neste centro."
              onRowClick={(f) => router.push(`/portal/formadores/${f.id}`)}
              rowActions={(f) => (
                <div className="flex items-center gap-0.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Abrir perfil"
                    title="Perfil"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/portal/formadores/${f.id}`);
                    }}
                  >
                    <UserRound className="h-3.5 w-3.5 text-sky-400" />
                  </Button>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Editar"
                      title="Editar dados"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/portal/formadores/${f.id}`);
                      }}
                      className={cn(
                        !f.ccNumero?.trim() &&
                          !f.ccpNumero?.trim() &&
                          "ring-1 ring-amber-400/50",
                      )}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              )}
            />
          </CardContent>
        </Card>
      </DgertTarget>
    </>
  );
}
