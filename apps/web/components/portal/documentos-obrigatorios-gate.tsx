"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { bffFetch } from "@/lib/client/bff-fetch";
import { getAccessToken } from "@/lib/client/access-token";
import { decodeJwtPayload, decodeJwtRole, isFormandoRole } from "@/lib/client/jwt-role";
import type { DocObrigatorioResumo } from "@/lib/formando/documentos-obrigatorios";
import type { FormadorDocObrigatorioResumo } from "@/lib/formador/documentos-obrigatorios";

const EVENT_NAME = "documentos-obrigatorios-updated";

export function notifyDocumentosObrigatoriosUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

type GateItem = {
  id: string;
  label: string;
  completo: boolean;
  detalhe: string;
  obrigatorio?: boolean;
};

export type DocumentosObrigatoriosState = {
  ready: boolean;
  roleKind: "formador" | "formando" | null;
  completo: boolean;
  emFaltaCount: number;
  items: GateItem[];
};

const defaultState: DocumentosObrigatoriosState = {
  ready: false,
  roleKind: null,
  completo: true,
  emFaltaCount: 0,
  items: [],
};

const DocumentosObrigatoriosContext = createContext<DocumentosObrigatoriosState>(defaultState);

export function useDocumentosObrigatorios() {
  return useContext(DocumentosObrigatoriosContext);
}

/**
 * Estado global dos documentos universais / do cargo (formando e formador).
 * Não bloqueia a navegação - use o dot neon e o modal no logout.
 */
export function DocumentosObrigatoriosProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DocumentosObrigatoriosState>(defaultState);

  const check = useCallback(async () => {
    const token = getAccessToken();
    const payload = decodeJwtPayload(token);
    const role = decodeJwtRole(token);

    if (!role || role === "super_admin" || payload?.impersonating) {
      setState({ ...defaultState, ready: true });
      return;
    }

    if (role === "formador") {
      const r = await bffFetch("/api/v1/formadores/me/documentos/obrigatorios", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        setState({ ...defaultState, ready: true, roleKind: "formador" });
        return;
      }
      const data = (await r.json()) as FormadorDocObrigatorioResumo;
      const emFalta = data.items.filter((i) => i.obrigatorio && !i.completo);
      setState({
        ready: true,
        roleKind: "formador",
        completo: data.completo,
        emFaltaCount: emFalta.length,
        items: data.items,
      });
      return;
    }

    if (isFormandoRole(role)) {
      const r = await bffFetch("/api/v1/formando-portal/documentos/obrigatorios", {
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        setState({ ...defaultState, ready: true, roleKind: "formando" });
        return;
      }
      const data = (await r.json()) as DocObrigatorioResumo;
      const emFalta = data.items.filter((i) => i.obrigatorio && !i.completo);
      setState({
        ready: true,
        roleKind: "formando",
        completo: data.completo,
        emFaltaCount: emFalta.length,
        items: data.items,
      });
      return;
    }

    setState({ ...defaultState, ready: true });
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    const onUpdated = () => void check();
    window.addEventListener(EVENT_NAME, onUpdated);
    return () => window.removeEventListener(EVENT_NAME, onUpdated);
  }, [check]);

  const value = useMemo(() => state, [state]);

  return (
    <DocumentosObrigatoriosContext.Provider value={value}>
      {children}
    </DocumentosObrigatoriosContext.Provider>
  );
}

/** @deprecated Use DocumentosObrigatoriosProvider */
export const DocumentosObrigatoriosGate = DocumentosObrigatoriosProvider;
