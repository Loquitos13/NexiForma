import { bffFetch } from "@/lib/client/bff-fetch";
import type { DocObrigatorioResumo } from "@/lib/formando/documentos-obrigatorios";
import type { FormadorDocObrigatorioResumo } from "@/lib/formador/documentos-obrigatorios";
import type { PendenciaSessaoItem } from "@/components/portal/pendencias-documentacao-dialog";

export type DocsObrigatoriosLogoutInfo = {
  roleKind: "formador" | "formando";
  profileDocsHref: string;
  sessoes: PendenciaSessaoItem[];
};

export async function fetchDocsObrigatoriosLogoutInfo(
  role: string | undefined,
): Promise<DocsObrigatoriosLogoutInfo | null> {
  if (role === "formador") {
    const r = await bffFetch("/api/v1/formadores/me/documentos/obrigatorios", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as FormadorDocObrigatorioResumo;
    if (data.completo) return null;
    const emFalta = data.items.filter((i) => !i.completo);
    if (!emFalta.length) return null;
    const href = "/portal/formador/perfil?tab=documentos";
    return {
      roleKind: "formador",
      profileDocsHref: href,
      sessoes: [
        {
          acaoLabel: "Documentos obrigatórios",
          href,
          itens: emFalta.map((i) => ({ label: i.label, href })),
        },
      ],
    };
  }

  if (role === "formando") {
    const r = await bffFetch("/api/v1/formando-portal/documentos/obrigatorios", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as DocObrigatorioResumo;
    if (data.completo) return null;
    const emFalta = data.items.filter((i) => !i.completo);
    if (!emFalta.length) return null;
    const href = "/portal/formando/perfil?tab=documentos";
    return {
      roleKind: "formando",
      profileDocsHref: href,
      sessoes: [
        {
          acaoLabel: "Documentos universais obrigatórios",
          href,
          itens: emFalta.map((i) => ({ label: i.label, href })),
        },
      ],
    };
  }

  return null;
}

export async function avisarLogoutDocsObrigatorios(roleKind: "formador" | "formando") {
  const url =
    roleKind === "formador"
      ? "/api/v1/formadores/me/documentos/obrigatorios/avisar-logout"
      : "/api/v1/formando-portal/documentos/obrigatorios/avisar-logout";
  const avisoRes = await bffFetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: "{}",
    keepalive: true,
  });
  if (!avisoRes.ok) {
    console.warn(
      "[logout] aviso documentos obrigatórios falhou:",
      avisoRes.status,
      await avisoRes.text().catch(() => ""),
    );
    return;
  }
  const data = (await avisoRes.json().catch(() => null)) as {
    avisado?: boolean;
    emails?: number;
  } | null;
  if (data?.avisado && (data.emails ?? 0) === 0) {
    console.warn(
      "[logout] aviso documentos obrigatórios sem emails entregues (verifica MAIL_REPLY_TO)",
    );
  }
}
