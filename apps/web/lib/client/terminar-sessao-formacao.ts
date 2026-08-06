import { bffFetch } from "@/lib/client/bff-fetch";
import { parseApiError } from "@/lib/ui/backoffice";

export type PendenciasFechoSessao = {
  temPendencias: boolean;
  folhaPendente: boolean;
  sumarioPendente: boolean;
  folhasTotal: number;
  folhasSemValidacao: number;
  itens: string[];
};

export type TerminarSessaoResult = {
  ok: boolean;
  sessaoId: string;
  terminadaEm: string;
  alreadyEnded?: boolean;
  presencasFechadas?: number;
  turmasSincronizadas?: number;
  pendencias?: PendenciasFechoSessao | null;
  avisoPedagogicoEnviado?: boolean;
};

type ConflictBody = {
  code?: string;
  message?: string | string[] | ConflictBody;
  pendencias?: PendenciasFechoSessao;
};

function extractPendenciasConflict(body: ConflictBody | null): {
  code?: string;
  pendencias?: PendenciasFechoSessao;
  message?: string;
} {
  if (!body) return {};
  const nested =
    body.message && typeof body.message === "object" && !Array.isArray(body.message)
      ? body.message
      : null;
  const code = body.code ?? nested?.code;
  const pendencias = body.pendencias ?? nested?.pendencias;
  const message =
    typeof body.message === "string"
      ? body.message
      : typeof nested?.message === "string"
        ? nested.message
        : undefined;
  return { code, pendencias, message };
}

/**
 * Termina sessão com confirmação obrigatória se folha/sumário estiverem pendentes.
 * A API devolve 409 até `confirmarPendencias: true`.
 * Preferir `confirmPendencias` in-app (Promise); evita window.confirm do browser.
 */
export async function terminarSessaoFormacaoComConfirmacao(
  sessaoId: string,
  opts?: {
    confirmPendencias?: (pendencias: PendenciasFechoSessao) => Promise<boolean>;
  },
): Promise<
  | { ok: true; data: TerminarSessaoResult }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: string }
> {
  async function post(confirmarPendencias: boolean) {
    return bffFetch(`/api/v1/sessoes-formacao/${encodeURIComponent(sessaoId)}/terminar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ confirmarPendencias }),
    });
  }

  let res = await post(false);

  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as ConflictBody | null;
    const parsed = extractPendenciasConflict(body);
    if (parsed.code === "PENDENCIAS_FECHO" || parsed.pendencias?.temPendencias) {
      const pendencias = parsed.pendencias ?? {
        temPendencias: true,
        folhaPendente: true,
        sumarioPendente: true,
        folhasTotal: 0,
        folhasSemValidacao: 0,
        itens: ["Documentação pedagógica por concluir"],
      };
      if (!opts?.confirmPendencias) {
        return {
          ok: false,
          error: "É necessário confirmar as pendências da sessão no portal.",
        };
      }
      const ok = await opts.confirmPendencias(pendencias);
      if (!ok) return { ok: false, cancelled: true };
      res = await post(true);
    }
  }

  if (!res.ok) {
    return { ok: false, error: await parseApiError(res) };
  }

  const data = (await res.json()) as TerminarSessaoResult;
  return { ok: true, data };
}
