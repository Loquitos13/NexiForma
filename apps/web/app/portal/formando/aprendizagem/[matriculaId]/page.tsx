"use client";

import { useParams } from "next/navigation";
import { FormandoAprendizagemView } from "@/components/formando/formando-aprendizagem-view";

export default function FormandoAprendizagemPage() {
  const params = useParams<{ matriculaId: string }>();
  return <FormandoAprendizagemView matriculaId={params.matriculaId} />;
}
