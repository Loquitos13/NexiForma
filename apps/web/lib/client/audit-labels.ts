/** Rótulos legíveis para acções de auditoria no portal tenant. */
const ACTION_LABELS: Record<string, string> = {
  "dgert.inspecao.export": "Export pacote inspeção (ZIP)",
  "dgert.inspecao.archive": "Arquivar pacote inspeção",
  "dgert.dossie.export": "Export dossiê JSON",
  "dgert.dossie.html": "Export dossiê HTML",
  "dgert.dossie.generate": "Gerar dossiê técnico-pedagógico",
  "dgert.sigo.export": "Export SIGO JSON",
  "dgert.sigo.csv": "Export SIGO CSV formandos",
  "dgert.arquivo.store": "Arquivar export no storage",
  "dgert.arquivo.download": "Download arquivo exportado",
  "sigo.submit.soap": "Submissão SIGO (SOAP)",
  "sigo.submit.http": "Submissão SIGO (HTTP)",
  "sigo.certificados.sync": "Sincronização certificados SIGO",
  "saft.export": "Export SAF-T PT (XML)",
  "faturacao.auditoria.export": "Pacote auditoria fiscal (ZIP)",
  "fatura.download": "Download documento fatura",
  "fatura.emitir": "Emissão de fatura",
  "fatura.comunicar_at": "Comunicação fatura à AT",
  "fatura.reenviar_at": "Reenvio comunicação AT",
  "fatura.anular": "Anulação de fatura",
  "at.licenca.accepted": "Licença AT aceite",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export const DGERT_AUDIT_ACTION_PRESETS = [
  { value: "", label: "Todas (DGERT/SIGO)" },
  { value: "dgert.inspecao.export", label: "Pacote inspeção" },
  { value: "dgert.dossie.export", label: "Dossiê JSON" },
  { value: "dgert.sigo.export", label: "SIGO JSON" },
  { value: "sigo.submit", label: "Submissões SIGO" },
] as const;

export const FATURACAO_AUDIT_ACTION_PRESETS = [
  { value: "", label: "Todas (faturação)" },
  { value: "saft.export", label: "SAF-T PT" },
  { value: "faturacao.auditoria.export", label: "Pacote auditoria" },
  { value: "fatura.emitir", label: "Emissões" },
  { value: "fatura.comunicar_at", label: "Comunicações AT" },
  { value: "fatura.anular", label: "Anulações" },
] as const;
