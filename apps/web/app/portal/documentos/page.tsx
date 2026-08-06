"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** A secção Documentos da nav foi removida: docs do formando ficam na ficha; templates na acção. */
export default function DocumentosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/portal/formandos");
  }, [router]);
  return (
    <p className="text-sm text-slate-400 p-6">
      A gestão de documentos passou para a ficha do formando e para a tab Documentos da acção de
      formação…
    </p>
  );
}
