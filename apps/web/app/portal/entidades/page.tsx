"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Redireccionamento legado → Clientes */
export default function EntidadesRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/portal/clientes?${q}` : "/portal/clientes");
  }, [router, searchParams]);

  return null;
}
