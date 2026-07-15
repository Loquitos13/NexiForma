"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormandoQuizInline } from "@/components/formando/formando-quiz-inline";
import Link from "next/link";

export default function QuizPlayerPage() {
  const params = useParams<{ moduloId: string }>();
  const moduloId = params.moduloId;
  const search = useSearchParams();
  const router = useRouter();
  const matriculaId = search.get("matriculaId") ?? "";

  useEffect(() => {
    if (matriculaId) {
      router.replace(`/portal/formando/aprendizagem/${matriculaId}?tarefa=${moduloId}`);
    }
  }, [matriculaId, moduloId, router]);

  if (matriculaId) {
    return <p className="px-5 py-8 text-center text-sm text-slate-500">A redirecionar para o curso…</p>;
  }

  const aprendizagemHref = "/portal/formando";

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 space-y-6">
      <Link
        href={aprendizagemHref}
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
      >
        ← Portal do formando
      </Link>
      <FormandoQuizInline moduloId={moduloId} matriculaId={matriculaId} />
    </div>
  );
}
