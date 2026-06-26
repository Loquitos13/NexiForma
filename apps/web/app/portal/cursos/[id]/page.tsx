"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BookOpen, GraduationCap, Pencil } from "lucide-react";
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
  estadoBadge,
  PageHeader,
  type Column,
} from "@/components/ui";
import { PageContentSkeleton } from "@/components/ui/page-skeleton";

type AcaoRow = {
  id: string;
  codigoInterno: string;
  titulo: string;
  estado: string;
  dataInicio: string;
  dataFim: string;
};

type CursoDetail = {
  id: string;
  codigoUfcd: string | null;
  designacao: string;
  cargaHoras: number;
  modalidade: string;
  objetivos: string | null;
  acoesFormacao: AcaoRow[];
};

const MODALIDADE_LABEL: Record<string, string> = {
  presencial: "Presencial",
  "b-learning": "B-learning",
  "e-learning": "E-learning",
};

const ACao_COLS: Column<AcaoRow>[] = [
  {
    key: "codigo",
    header: "Código",
    cell: (a) => (
      <Link href={`/portal/acoes/${a.id}`} className="font-semibold text-blue-400 hover:text-blue-300">
        {a.codigoInterno}
      </Link>
    ),
  },
  { key: "titulo", header: "Título", cell: (a) => <span className="text-slate-200">{a.titulo}</span> },
  { key: "estado", header: "Estado", cell: (a) => estadoBadge(a.estado) },
  {
    key: "periodo",
    header: "Período",
    cell: (a) => (
      <span className="text-sm text-slate-400 tabular-nums">
        {String(a.dataInicio).slice(0, 10)} – {String(a.dataFim).slice(0, 10)}
      </span>
    ),
  },
];

export default function CursoDetailPage() {
  const params = useParams();
  const cursoId = String(params.id ?? "");
  const { canManage } = useTenantRole();
  const [curso, setCurso] = useState<CursoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!cursoId) return;
    setLoading(true);
    setError(null);
    const res = await bffFetch(`/api/v1/cursos/${cursoId}`, { headers: { accept: "application/json" } });
    if (!res.ok) {
      setError(await parseApiError(res));
      setCurso(null);
    } else {
      setCurso((await res.json()) as CursoDetail);
    }
    setLoading(false);
  }, [cursoId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !curso) {
    return <PageContentSkeleton variant="detail" />;
  }

  if (!curso) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error ?? "Curso não encontrado."}</Alert>
        <Link href="/portal/cursos" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/portal/cursos" className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300">
          <ArrowLeft className="h-3.5 w-3.5" />
          Cursos
        </Link>
      </div>

      <PageHeader
        title={curso.designacao}
        description={
          curso.codigoUfcd
            ? `UFCD ${curso.codigoUfcd} · ${curso.cargaHoras}h · ${MODALIDADE_LABEL[curso.modalidade] ?? curso.modalidade}`
            : `${curso.cargaHoras}h · ${MODALIDADE_LABEL[curso.modalidade] ?? curso.modalidade}`
        }
        actions={
          canManage ? (
            <Button variant="secondary" size="sm" onClick={() => window.location.assign("/portal/cursos")}>
              <Pencil className="h-3.5 w-3.5" />
              Editar no catálogo
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-blue-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{curso.cargaHoras}h</p>
              <p className="text-xs text-slate-500">Carga horária</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-teal-400/80" />
            <div>
              <p className="text-2xl font-bold text-slate-100">{curso.acoesFormacao.length}</p>
              <p className="text-xs text-slate-500">Acções de formação</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            {curso.codigoUfcd ? (
              <Badge variant="blue" className="text-base px-3 py-1">UFCD {curso.codigoUfcd}</Badge>
            ) : (
              <span className="text-sm text-slate-500">Sem código UFCD</span>
            )}
            <p className="text-xs text-slate-500 mt-2">
              <Link href="/portal/catalogo-ufcd" className="text-blue-400 hover:text-blue-300">
                Consultar catálogo nacional
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {curso.objetivos ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Objectivos de aprendizagem</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{curso.objetivos}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Acções de formação</CardTitle>
          {canManage ? (
            <Link
              href="/portal/acoes"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Criar nova acção →
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          <DataTable
            columns={ACao_COLS}
            data={curso.acoesFormacao}
            keyField="id"
            loading={false}
            emptyMessage="Este curso ainda não tem acções de formação."
          />
        </CardContent>
      </Card>
    </>
  );
}
