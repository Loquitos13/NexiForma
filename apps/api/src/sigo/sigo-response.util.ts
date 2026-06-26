export type SigoRemoteStatus = {
  estado: "ACEITE" | "REJEITADA" | "SUBMETIDA" | "PENDENTE" | "ERRO";
  erros: Array<{ codigo?: string; mensagem: string; campo?: string }>;
  mensagem?: string;
};

/** Interpreta resposta genérica da API SIGO (contrato configurável até API oficial DGEEC). */
export function parseSigoRemoteStatus(json: unknown): SigoRemoteStatus {
  if (!json || typeof json !== "object") {
    return { estado: "ERRO", erros: [{ mensagem: "Resposta SIGO inválida." }] };
  }

  const o = json as Record<string, unknown>;
  const rawEstado =
    String(o.estado ?? o.status ?? o.state ?? "").toUpperCase() || "SUBMETIDA";

  const errosRaw = o.erros ?? o.errors ?? o.validationErrors;
  const erros: SigoRemoteStatus["erros"] = Array.isArray(errosRaw)
    ? errosRaw.map((e) => {
        const item = e as Record<string, unknown>;
        return {
          codigo: item.codigo != null ? String(item.codigo) : item.code != null ? String(item.code) : undefined,
          mensagem: String(item.mensagem ?? item.message ?? item.descricao ?? "Erro SIGO"),
          campo: item.campo != null ? String(item.campo) : item.field != null ? String(item.field) : undefined,
        };
      })
    : [];

  if (rawEstado.includes("ACEIT") || rawEstado === "OK" || rawEstado === "SUCCESS") {
    return { estado: "ACEITE", erros, mensagem: String(o.mensagem ?? o.message ?? "Aceite pela SIGO.") };
  }
  if (rawEstado.includes("REJEIT") || rawEstado === "FAILED" || rawEstado === "ERROR") {
    return {
      estado: "REJEITADA",
      erros: erros.length ? erros : [{ mensagem: String(o.mensagem ?? o.message ?? "Rejeitada pela SIGO.") }],
    };
  }
  if (rawEstado.includes("PEND") || rawEstado === "PROCESSING") {
    return { estado: "PENDENTE", erros, mensagem: "Aguarda processamento SIGO." };
  }

  return { estado: "SUBMETIDA", erros, mensagem: "Submetida - reconciliar mais tarde." };
}
