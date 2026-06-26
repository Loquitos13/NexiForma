"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText, Mail, Phone, Users } from "lucide-react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";
import { cn } from "@/lib/ui/cn";

type Entidade = {
  id: string;
  nif: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  _count?: { formandos: number; propostas: number };
};

export default function EntidadeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [entidade, setEntidade] = useState<Entidade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bffFetch(`/api/v1/entidades-cliente/${id}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) setError(await parseApiError(res));
    else setEntidade((await res.json()) as Entidade);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (id) void load();
  }, [load, id]);

  if (loading) {
    return <PageContentSkeleton variant="detail" />;
  }

  if (error || !entidade) {
    return (
      <>
        <Link href="/portal/entidades" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Alert variant="error">{error ?? "Entidade não encontrada."}</Alert>
      </>
    );
  }

  return (
    <>
      <Link href="/portal/entidades" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4")}>
        <ArrowLeft className="h-4 w-4" /> Entidades
      </Link>

      <PageHeader
        title={entidade.nome}
        description={`NIF ${entidade.nif}`}
        actions={
          <Link
            href={`/portal/propostas?entidade=${entidade.id}&nova=1`}
            className={cn(buttonVariants())}
          >
            <FileText className="h-4 w-4" />
            Nova proposta
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <Users className="h-8 w-8 text-amber-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{entidade._count?.formandos ?? 0}</p>
              <p className="text-xs text-slate-500">Formandos associados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <FileText className="h-8 w-8 text-violet-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{entidade._count?.propostas ?? 0}</p>
              <p className="text-xs text-slate-500">Propostas comerciais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Contacto</p>
            {entidade.email && (
              <p className="text-sm text-slate-300 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-slate-500" />
                {entidade.email}
              </p>
            )}
            {entidade.telefone && (
              <p className="text-sm text-slate-300 flex items-center gap-2 mt-1">
                <Phone className="h-3.5 w-3.5 text-slate-500" />
                {entidade.telefone}
              </p>
            )}
            {!entidade.email && !entidade.telefone && (
              <Badge variant="default">Sem contacto registado</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acções</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link
            href={`/portal/propostas?entidade=${entidade.id}`}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Ver propostas
          </Link>
          <Button variant="secondary" disabled title="Ligação a formandos corporativos - próxima fase">
            Gerir formandos B2B
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
