"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Redireccionamento legado → Clientes */
export default function EntidadeDetailRedirectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  useEffect(() => {
    if (params.id) {
      router.replace(`/portal/clientes/${params.id}`);
    }
  }, [router, params.id]);

  return null;
}
