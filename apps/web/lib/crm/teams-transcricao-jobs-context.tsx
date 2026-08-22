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
import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";
import { TeamsTranscricaoNotaModal } from "@/components/crm/teams-transcricao-nota-modal";

export type TeamsTranscricaoJobStatus =
  | "IMPORTANDO"
  | "PRONTO"
  | "FALHA"
  | "NOTA_CRIADA"
  | "DESCARTADO";

export type TeamsTranscricaoJob = {
  reuniaoId: string;
  titulo: string;
  entidadeClienteId?: string | null;
  leadComercialId?: string | null;
  clienteNome?: string | null;
  duracaoSegundos?: number | null;
  status: TeamsTranscricaoJobStatus;
  transcricao?: string | null;
  mensagem?: string | null;
  notaJaCriada?: boolean;
  modalOpen: boolean;
  createdAt: number;
  pollCount: number;
};

export type AgendarTranscricaoReuniaoInput = {
  reuniaoId: string;
  titulo?: string | null;
  entidadeClienteId?: string | null;
  leadComercialId?: string | null;
  clienteNome?: string | null;
  duracaoSegundos?: number | null;
  notaJaCriada?: boolean;
  temSalaTeams?: boolean;
};

type TeamsTranscricaoJobsContextValue = {
  jobs: TeamsTranscricaoJob[];
  agendarImportacaoReuniao: (input: AgendarTranscricaoReuniaoInput) => void;
  abrirModal: (reuniaoId: string) => void;
  fecharModal: (reuniaoId: string) => void;
  descartarJob: (reuniaoId: string) => void;
  marcarNotaCriada: (reuniaoId: string) => void;
  jobActivo: TeamsTranscricaoJob | null;
};

const STORAGE_KEY = "nexiforma_teams_transcricao_jobs_v1";
const POLL_MS = 20_000;
const MAX_POLLS = 90;

const TeamsTranscricaoJobsContext = createContext<TeamsTranscricaoJobsContextValue | null>(null);

type InteraccaoPoll = {
  teamsTranscricao?: string | null;
  teamsTranscricaoEstado?: string | null;
};

export function TeamsTranscricaoJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TeamsTranscricaoJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TeamsTranscricaoJob[];
        setJobs(
          parsed.filter(
            (j) => j.status === "IMPORTANDO" || (j.status === "PRONTO" && j.modalOpen),
          ),
        );
      }
    } catch {
      // ignorar
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch {
      // ignorar quota
    }
  }, [jobs, hydrated]);

  const patchJob = useCallback((reuniaoId: string, patch: Partial<TeamsTranscricaoJob>) => {
    setJobs((prev) => prev.map((j) => (j.reuniaoId === reuniaoId ? { ...j, ...patch } : j)));
  }, []);

  const agendarImportacaoReuniao = useCallback(
    (input: AgendarTranscricaoReuniaoInput) => {
      if (!input.temSalaTeams) return;
      const existing = jobsRef.current.find((j) => j.reuniaoId === input.reuniaoId);
      if (existing && existing.status !== "DESCARTADO" && existing.status !== "FALHA") return;

      const job: TeamsTranscricaoJob = {
        reuniaoId: input.reuniaoId,
        titulo: input.titulo?.trim() || "Reunião Teams",
        entidadeClienteId: input.entidadeClienteId,
        leadComercialId: input.leadComercialId,
        clienteNome: input.clienteNome,
        duracaoSegundos: input.duracaoSegundos,
        notaJaCriada: input.notaJaCriada,
        status: "IMPORTANDO",
        modalOpen: false,
        createdAt: Date.now(),
        pollCount: 0,
      };

      setJobs((prev) => [job, ...prev.filter((j) => j.reuniaoId !== input.reuniaoId)]);

      void bffFetch(`/api/v1/crm/interaccoes/${input.reuniaoId}/teams/transcricao`, {
        method: "POST",
        headers: { accept: "application/json" },
      }).catch(() => undefined);
    },
    [],
  );

  const abrirModal = useCallback((reuniaoId: string) => {
    patchJob(reuniaoId, { modalOpen: true });
  }, [patchJob]);

  const fecharModal = useCallback((reuniaoId: string) => {
    patchJob(reuniaoId, { modalOpen: false });
  }, [patchJob]);

  const descartarJob = useCallback((reuniaoId: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.reuniaoId === reuniaoId ? { ...j, status: "DESCARTADO", modalOpen: false } : j,
      ),
    );
  }, []);

  const marcarNotaCriada = useCallback((reuniaoId: string) => {
    patchJob(reuniaoId, { status: "NOTA_CRIADA", modalOpen: false });
  }, [patchJob]);

  useEffect(() => {
    let cancelled = false;

    async function pollOne(job: TeamsTranscricaoJob) {
      if (cancelled) return;

      const current = jobsRef.current.find((j) => j.reuniaoId === job.reuniaoId);
      if (!current || current.status !== "IMPORTANDO") return;

      const nextPoll = current.pollCount + 1;
      if (nextPoll > MAX_POLLS) {
        patchJob(job.reuniaoId, {
          status: "FALHA",
          mensagem: "Tempo esgotado - tenta importar manualmente no calendário.",
          pollCount: nextPoll,
        });
        return;
      }

      try {
        if (nextPoll === 1 || nextPoll % 3 === 0) {
          await bffFetch(`/api/v1/crm/interaccoes/${job.reuniaoId}/teams/transcricao`, {
            method: "POST",
            headers: { accept: "application/json" },
          });
        }

        const res = await bffFetch(`/api/v1/crm/interaccoes/${job.reuniaoId}`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) {
          patchJob(job.reuniaoId, { pollCount: nextPoll });
          return;
        }

        const data = (await res.json()) as InteraccaoPoll;
        const estado = data.teamsTranscricaoEstado;
        const texto = data.teamsTranscricao;

        if (estado === "DISPONIVEL" && texto) {
          patchJob(job.reuniaoId, {
            status: "PRONTO",
            transcricao: texto,
            modalOpen: true,
            pollCount: nextPoll,
            mensagem: null,
          });
          return;
        }

        if (estado === "ERRO") {
          patchJob(job.reuniaoId, {
            status: "FALHA",
            mensagem: "Sem permissão ou erro ao importar a transcrição Teams.",
            pollCount: nextPoll,
          });
          return;
        }

        patchJob(job.reuniaoId, { pollCount: nextPoll });
      } catch {
        patchJob(job.reuniaoId, { pollCount: nextPoll });
      }
    }

    async function tick() {
      const importing = jobsRef.current.filter((j) => j.status === "IMPORTANDO");
      for (const job of importing) {
        await pollOne(job);
      }
    }

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [patchJob]);

  const jobActivo = jobs.find((j) => j.modalOpen && j.status === "PRONTO") ?? null;

  return (
    <TeamsTranscricaoJobsContext.Provider
      value={{
        jobs,
        agendarImportacaoReuniao,
        abrirModal,
        fecharModal,
        descartarJob,
        marcarNotaCriada,
        jobActivo,
      }}
    >
      {children}
      <TeamsTranscricaoNotaModal job={jobActivo} />
    </TeamsTranscricaoJobsContext.Provider>
  );
}

const DEFAULT: TeamsTranscricaoJobsContextValue = {
  jobs: [],
  agendarImportacaoReuniao: () => {},
  abrirModal: () => {},
  fecharModal: () => {},
  descartarJob: () => {},
  marcarNotaCriada: () => {},
  jobActivo: null,
};

export function useTeamsTranscricaoJobs(): TeamsTranscricaoJobsContextValue {
  return useContext(TeamsTranscricaoJobsContext) ?? DEFAULT;
}

export async function criarNotaComercialFromTranscricao(
  job: TeamsTranscricaoJob,
  fields: {
    contexto?: string;
    situacaoActual?: string;
    dorNecessidade?: string;
    orcamentoTiming?: string;
    decisor?: string;
    proximoPassoNota?: string;
    notasLivres?: string;
  },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const transcricao = job.transcricao?.trim();
  if (!transcricao) return { ok: false, erro: "Transcrição em falta." };

  const bloco = `--- Transcrição Teams ---\n${transcricao}`;
  const notasLivres = [fields.notasLivres?.trim(), bloco].filter(Boolean).join("\n\n");

  const res = await bffFetch("/api/v1/crm/interaccoes", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      tipo: "NOTA",
      titulo: job.titulo ? `Follow-up: ${job.titulo}` : "Follow-up reunião Teams",
      contexto: fields.contexto?.trim() || undefined,
      situacaoActual: fields.situacaoActual?.trim() || undefined,
      dorNecessidade: fields.dorNecessidade?.trim() || undefined,
      orcamentoTiming: fields.orcamentoTiming?.trim() || undefined,
      decisor: fields.decisor?.trim() || undefined,
      proximoPassoNota: fields.proximoPassoNota?.trim() || undefined,
      notasLivres,
      entidadeClienteId: job.entidadeClienteId ?? undefined,
      leadComercialId: job.leadComercialId ?? undefined,
      reuniaoOrigemId: job.reuniaoId,
    }),
  });

  if (!res.ok) {
    return { ok: false, erro: await parseApiError(res) };
  }
  return { ok: true };
}
