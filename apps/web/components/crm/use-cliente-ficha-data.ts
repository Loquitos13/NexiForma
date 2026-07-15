"use client";

import { useCallback, useEffect, useState } from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parsePaginatedList } from "@/lib/crm/paginated-list";

export type ClienteFichaProposta = {
  id: string;
  codigo: string;
  titulo: string;
  estado: string;
  valorCentavos: number;
  validadeAte: string | null;
  createdAt?: string;
  criadoPor?: { displayName: string } | null;
  enviadaPor?: { displayName: string } | null;
};

export type ClienteFichaFatura = {
  id: string;
  estado: string;
  numero: number | null;
  valorCentavos: number;
  createdAt: string;
  serie: { codigo: string; tipo: string };
  proposta: { codigo: string } | null;
};

export type ClienteFichaInteraccao = {
  id: string;
  createdAt: string;
  tipo: string;
};

export type ClienteFichaData = {
  propostas: ClienteFichaProposta[];
  faturas: ClienteFichaFatura[];
  interaccoes: ClienteFichaInteraccao[];
  sugestoesPendentes: number;
  leadsCount: number;
  sugestoesTotal: number;
};

const EMPTY: ClienteFichaData = {
  propostas: [],
  faturas: [],
  interaccoes: [],
  sugestoesPendentes: 0,
  leadsCount: 0,
  sugestoesTotal: 0,
};

export function useClienteFichaData(
  entidadeId: string,
  enabled: boolean,
  includeFaturacao = false,
) {
  const [data, setData] = useState<ClienteFichaData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!enabled || !entidadeId) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [pRes, fRes, iRes, sPendRes, sAllRes, lRes] = await Promise.all([
      bffFetch(`/api/v1/crm/entidades/${entidadeId}/propostas?limit=100`, { headers: { accept: "application/json" } }),
      includeFaturacao
        ? bffFetch(`/api/v1/crm/faturas?entidadeClienteId=${entidadeId}`, { headers: { accept: "application/json" } })
        : Promise.resolve(null),
      bffFetch(`/api/v1/crm/interaccoes?entidadeClienteId=${entidadeId}&pageSize=100`, {
        headers: { accept: "application/json" },
      }),
      bffFetch(
        `/api/v1/crm/sugestoes-ia?estado=PENDENTE&entidadeClienteId=${entidadeId}&limit=50`,
        { headers: { accept: "application/json" } },
      ),
      bffFetch(
        `/api/v1/crm/sugestoes-ia?entidadeClienteId=${entidadeId}&limit=100`,
        { headers: { accept: "application/json" } },
      ),
      bffFetch(
        `/api/v1/crm/leads?entidadeClienteId=${entidadeId}&pageSize=1`,
        { headers: { accept: "application/json" } },
      ),
    ]);

    const propostasPayload = pRes.ok
      ? ((await pRes.json()) as { propostas?: ClienteFichaProposta[] } | ClienteFichaProposta[])
      : null;
    const propostas = Array.isArray(propostasPayload)
      ? propostasPayload
      : (propostasPayload?.propostas ?? []);
    const faturasRaw = fRes?.ok ? await fRes.json() : [];
    const faturas = Array.isArray(faturasRaw) ? (faturasRaw as ClienteFichaFatura[]) : [];
    const interaccoesRaw = iRes.ok ? await iRes.json() : null;
    const interParsed = parsePaginatedList<ClienteFichaInteraccao>(interaccoesRaw);
    const interaccoes = interParsed.items;
    const sugestoesPendRaw = sPendRes.ok ? await sPendRes.json() : [];
    const sugestoesPend = Array.isArray(sugestoesPendRaw) ? sugestoesPendRaw : [];
    const sugestoesAllRaw = sAllRes.ok ? await sAllRes.json() : [];
    const sugestoesAll = Array.isArray(sugestoesAllRaw) ? sugestoesAllRaw : [];
    const leadsParsed = lRes.ok ? parsePaginatedList(await lRes.json()) : { total: 0 };
    const leadsCount = leadsParsed.total;

    setData({
      propostas,
      faturas,
      interaccoes,
      sugestoesPendentes: sugestoesPend.length,
      leadsCount,
      sugestoesTotal: sugestoesAll.length,
    });
    setLoading(false);
  }, [entidadeId, enabled, includeFaturacao]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
}
