"use client";

import { useEffect, useState } from "react";
import { isModuloStorageRef } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";

/** Carrega ficheiro LMS autenticado (storage interno) como blob URL para `<video>` / `<img>`. */
export function useModuloMediaBlobUrl(
  moduloId: string | null | undefined,
  urlOuRef: string | null | undefined,
): { blobUrl: string | null; loading: boolean; error: string | null } {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moduloId || !isModuloStorageRef(urlOuRef)) {
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let revoked = false;
    setLoading(true);
    setError(null);

    void bffFetch(`/api/v1/conteudos-lms/modulos/${moduloId}/media`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Não foi possível carregar o ficheiro.");
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch((err: unknown) => {
        if (!revoked) {
          setError(err instanceof Error ? err.message : "Erro ao carregar o ficheiro.");
        }
      })
      .finally(() => {
        if (!revoked) setLoading(false);
      });

    return () => {
      revoked = true;
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [moduloId, urlOuRef]);

  return { blobUrl, loading, error };
}
