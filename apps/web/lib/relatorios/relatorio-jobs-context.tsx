"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RelatorioInsightsRequest } from "@nexiforma/shared";
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";

export type RelatorioSecao = RelatorioInsightsRequest["secao"];

export type RelatorioJobStatus = "A_GERAR" | "PRONTO" | "FALHA";

export type RelatorioJob = {
  id: string;
  secao: RelatorioSecao;
  secaoLabel: string;
  status: RelatorioJobStatus;
  pdfBlobUrl?: string;
  filename?: string;
  erro?: string;
  createdAt: number;
};

const SECAO_LABELS: Record<RelatorioSecao, string> = {
  financeiro: "Financeiro",
  comercial: "Comercial",
  empresarial: "Empresarial",
};

type RelatorioJobsContextValue = {
  jobs: RelatorioJob[];
  gerarRelatorio: (secao: RelatorioSecao) => Promise<void>;
  descarregarRelatorio: (jobId: string) => void;
  descartarRelatorio: (jobId: string) => void;
  isGerando: (secao: RelatorioSecao) => boolean;
  getJobForSecao: (secao: RelatorioSecao) => RelatorioJob | undefined;
};

const RelatorioJobsContext = createContext<RelatorioJobsContextValue | null>(null);

const STORAGE_KEY = "nexiforma_relatorio_jobs_v1";

export function RelatorioJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<RelatorioJob[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  // Carregar do localStorage ao montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RelatorioJob[];
        // Sanitizar estados: se estava a gerar quando fechou a página, marca como falha ou mantém
        const sanitized = parsed.map((j) => {
          if (j.status === "A_GERAR") {
            return { ...j, status: "FALHA" as const, erro: "Interrompido pelo utilizador" };
          }
          return { ...j, pdfBlobUrl: undefined };
        });
        setJobs(sanitized);
      }
    } catch {
      // Ignorar erro de parsing
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Guardar no localStorage sempre que jobs mudar
  useEffect(() => {
    if (!isHydrated) return;
    try {
      const toStore = jobs.map(({ pdfBlobUrl: _, ...rest }) => rest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Ignorar erro de quota
    }
  }, [jobs, isHydrated]);

  const descartarRelatorio = useCallback((jobId: string) => {
    setJobs((prev) => {
      const target = prev.find((j) => j.id === jobId);
      if (target?.pdfBlobUrl) {
        URL.revokeObjectURL(target.pdfBlobUrl);
      }
      return prev.filter((j) => j.id !== jobId);
    });
  }, []);

  const descarregarRelatorio = useCallback(
    async (jobId: string) => {
      const job = jobsRef.current.find((j) => j.id === jobId);
      if (!job) return;

      if (job.pdfBlobUrl) {
        const a = document.createElement("a");
        a.href = job.pdfBlobUrl;
        a.download = job.filename ?? `relatorio-${job.secao}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Se foi recarregado e perdeu o blob em memória, descarrega diretamente do backend
      try {
        const res = await bffFetch("/api/v1/relatorios/insights/pdf", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/pdf" },
          body: JSON.stringify({ secao: job.secao } satisfies RelatorioInsightsRequest),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = job.filename ?? `relatorio-${job.secao}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch {
        // Silencioso
      }
    },
    [],
  );

  const gerarRelatorio = useCallback(
    async (secao: RelatorioSecao) => {
      // Se já está a gerar esta secção, não duplicar
      const existing = jobsRef.current.find(
        (j) => j.secao === secao && j.status === "A_GERAR",
      );
      if (existing) return;

      // Limpar job antigo da mesma secção se existir
      const oldJob = jobsRef.current.find((j) => j.secao === secao);
      if (oldJob) {
        descartarRelatorio(oldJob.id);
      }

      const id = `rel-${secao}-${Date.now()}`;
      const newJob: RelatorioJob = {
        id,
        secao,
        secaoLabel: SECAO_LABELS[secao] ?? secao,
        status: "A_GERAR",
        createdAt: Date.now(),
      };

      setJobs((prev) => [newJob, ...prev]);

      try {
        const res = await bffFetch("/api/v1/relatorios/insights/pdf", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/pdf" },
          body: JSON.stringify({ secao } satisfies RelatorioInsightsRequest),
        });

        if (!res.ok) {
          const errText = await parseApiError(res);
          setJobs((prev) =>
            prev.map((j) => (j.id === id ? { ...j, status: "FALHA", erro: errText } : j)),
          );
          return;
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `relatorio-${secao}-${stamp}.pdf`;

        setJobs((prev) =>
          prev.map((j) =>
            j.id === id
              ? {
                  ...j,
                  status: "PRONTO",
                  pdfBlobUrl: blobUrl,
                  filename,
                }
              : j,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro de ligação ao gerar relatório.";
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, status: "FALHA", erro: msg } : j)),
        );
      }
    },
    [descartarRelatorio],
  );

  const isGerando = useCallback(
    (secao: RelatorioSecao) => {
      return jobs.some((j) => j.secao === secao && j.status === "A_GERAR");
    },
    [jobs],
  );

  const getJobForSecao = useCallback(
    (secao: RelatorioSecao) => {
      return jobs.find((j) => j.secao === secao);
    },
    [jobs],
  );

  // Limpar ObjectURLs quando desmonta
  useEffect(() => {
    return () => {
      for (const job of jobsRef.current) {
        if (job.pdfBlobUrl) {
          URL.revokeObjectURL(job.pdfBlobUrl);
        }
      }
    };
  }, []);

  return (
    <RelatorioJobsContext.Provider
      value={{
        jobs,
        gerarRelatorio,
        descarregarRelatorio,
        descartarRelatorio,
        isGerando,
        getJobForSecao,
      }}
    >
      {children}
    </RelatorioJobsContext.Provider>
  );
}

const DEFAULT_VALUE: RelatorioJobsContextValue = {
  jobs: [],
  gerarRelatorio: async () => {},
  descarregarRelatorio: () => {},
  descartarRelatorio: () => {},
  isGerando: () => false,
  getJobForSecao: () => undefined,
};

export function useRelatorioJobs(): RelatorioJobsContextValue {
  const ctx = useContext(RelatorioJobsContext);
  return ctx ?? DEFAULT_VALUE;
}
