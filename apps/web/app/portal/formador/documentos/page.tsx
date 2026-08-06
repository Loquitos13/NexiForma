"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Compat: documentos passam a viver no perfil do formador. */
export default function FormadorDocumentosRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/portal/formador/perfil?tab=documentos");
  }, [router]);
  return null;
}
