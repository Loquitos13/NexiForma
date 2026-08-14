"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { bffFetch } from "@/lib/client/bff-fetch";
import { ActionContentBuilder } from "@/components/portal/ActionContentBuilder";
import { Alert } from "@/components/ui";

type CursoOpt = { id: string; designacao: string; codigoUfcd: string; cargaHoras: number };

const selectClass =
  "mt-1 w-full max-w-md px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/60 text-sm text-slate-200 outline-none focus:border-blue-500/40 transition-colors";

/** Editor LMS do fluxo guiado - reutiliza o builder de cursos (modos Editar/Mockup). */
export default function GuidedLmsContentEditor() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const cursoIdFromUrl = searchParams.get("cursoId") ?? "";

  const [cursos, setCursos] = useState<CursoOpt[]>([]);
  const [cursoId, setCursoId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void bffFetch("/api/v1/cursos", { headers: { accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) return;
        const rows = (await r.json()) as CursoOpt[];
        setCursos(rows);
        if (!rows.length) return;
        const pick =
          cursoIdFromUrl && rows.some((row) => row.id === cursoIdFromUrl)
            ? cursoIdFromUrl
            : rows[0].id;
        setCursoId(pick);
      })
      .finally(() => setLoading(false));
  }, [cursoIdFromUrl]);

  function selectCurso(id: string) {
    setCursoId(id);
    const q = new URLSearchParams(searchParams.toString());
    q.set("v", "conteudos");
    if (id) q.set("cursoId", id);
    else q.delete("cursoId");
    router.replace(`/portal/fluxo?${q.toString()}`);
  }

  const curso = cursos.find((c) => c.id === cursoId);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">A carregar cursos…</div>;
  }

  if (!cursos.length) {
    return (
      <div className="p-6">
        <Alert variant="warning">
          Ainda não existem cursos. Cria um curso em Formação → Cursos antes de registar conteúdos LMS.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Curso
          <select
            value={cursoId}
            onChange={(e) => selectCurso(e.target.value)}
            className={selectClass}
            data-guided-flow-anchor="lms-seleccionar-curso"
          >
            {cursos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigoUfcd} – {c.designacao}
              </option>
            ))}
          </select>
        </label>
        {curso ? (
          <p className="mt-1.5 text-[11px] text-slate-500">
            {curso.cargaHoras}h · partilhado por todas as acções deste curso · alterna Editar e Mockup
            para pré-visualizar como o formando
          </p>
        ) : null}
      </div>

      {cursoId ? (
        <ActionContentBuilder cursoId={cursoId} cursoTitulo={curso?.designacao} canEdit />
      ) : null}
    </div>
  );
}
