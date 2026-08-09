"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { DgertRequisitoBanner, DgertTarget } from "@/components/portal/dgert-requisito-banner";
import { bffFetch } from "@/lib/client/bff-fetch";
import { openHtmlForPrint } from "@/lib/client/open-html-for-print";
import { useClientTablePaging } from "@/lib/client/use-client-table-paging";
import { useTenantRole } from "@/lib/client/use-tenant-role";
import { ListPaginationControls } from "@/components/crm/list-pagination";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Select, TableScroll } from "@/components/ui";

type AcaoOpt = { id: string; codigoInterno: string; titulo: string };
type FormandoCert = {
  matriculaId: string;
  formando: { nome: string; nif: string };
  turmaCodigo: string;
  taxaPresenca: number | null;
  elegivelCertificado: boolean;
  codigoVerificacao?: string | null;
  certificadoSigo?: {
    id: string;
    numeroCertificado: string | null;
    emitidoEm: string | null;
    temFicheiro: boolean;
    referencia: string;
  } | null;
};

export default function CertificadosPage() {
  const { canManageFormacao: canManage } = useTenantRole();
  const [acoes, setAcoes] = useState<AcaoOpt[]>([]);
  const [acaoId, setAcaoId] = useState("");
  const [formandos, setFormandos] = useState<FormandoCert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const paging = useClientTablePaging(formandos, 10);

  useEffect(() => {
    void bffFetch("/api/v1/acoes-formacao", { headers: { accept: "application/json" } }).then(async (r) => {
      if (!r.ok) return;
      const rows = (await r.json()) as AcaoOpt[];
      setAcoes(rows);
      const fromUrl = new URLSearchParams(window.location.search).get("acao");
      const pick = fromUrl && rows.some((a) => a.id === fromUrl) ? fromUrl : rows[0]?.id ?? "";
      if (pick) setAcaoId(pick);
    });
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const r = await bffFetch(`/api/v1/certificados/acoes-formacao/${id}`, { headers: { accept: "application/json" } });
    setLoading(false);
    if (!r.ok) { setError("Erro ao carregar certificados."); setFormandos([]); return; }
    const data = (await r.json()) as { formandos: FormandoCert[] };
    setFormandos(data.formandos);
  }, []);

  useEffect(() => { if (acaoId) void load(acaoId); }, [acaoId, load]);

  function downloadSigo(certificadoId: string) {
    window.open(`/api/v1/sigo/certificados/${certificadoId}/download`, "_blank", "noopener,noreferrer");
  }

  async function imprimir(matriculaId: string) {
    const r = await bffFetch(`/api/v1/certificados/matricula/${matriculaId}/certificado.html`, { headers: { accept: "text/html" } });
    if (!r.ok) { setError("Erro ao gerar certificado."); return; }
    const html = await r.text();
    const opened = openHtmlForPrint(html);
    if (!opened.ok) {
      setError(opened.error);
      return;
    }
  }

  async function notificarElegiveis() {
    if (!acaoId) return;
    setNotifyBusy(true); setMsg(null); setError(null);
    const r = await bffFetch(`/api/v1/notificacoes/certificados/acoes-formacao/${acaoId}`, {
      method: "POST", headers: { accept: "application/json" },
    });
    setNotifyBusy(false);
    if (!r.ok) { setError("Erro ao notificar."); return; }
    const data = (await r.json()) as { elegiveis: number; enviados: number };
    setMsg(`${data.enviados} email(s) enviado(s) a formandos elegíveis (${data.elegiveis} total).`);
  }

  if (!canManage) {
    return (
      <>
        <PageHeader title="Certificados" description="Acede pelo portal formando ao teu certificado quando disponível." />
        <Link href="/portal/formando" className="text-sm text-blue-400 transition-colors hover:text-blue-300">Portal formando →</Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Certificados de formação"
        description="Emissão de certificados com base na assiduidade registada – imprimir ou guardar como PDF."
      />

      {error ? <Alert variant="error" className="mb-4">{error}</Alert> : null}
      {msg ? <Alert variant="success" className="mb-4">{msg}</Alert> : null}

      <DgertRequisitoBanner backHref={acaoId ? `/portal/dossie?acao=${acaoId}` : "/portal/dossie"} />

      <Card className="mb-6">
        <CardContent className="pt-5 space-y-3">
          <Select label="Acção de formação" value={acaoId} onChange={(e) => setAcaoId(e.target.value)} className="max-w-md">
            {acoes.map((a) => (
              <option key={a.id} value={a.id}>{a.codigoInterno} – {a.titulo}</option>
            ))}
          </Select>
          <Button variant="teal" disabled={notifyBusy || !acaoId} onClick={() => void notificarElegiveis()}>
            {notifyBusy ? "A notificar…" : "Notificar formandos elegíveis"}
          </Button>
        </CardContent>
      </Card>

      <DgertTarget id="certificados_lista">
      <Card>
        <CardHeader className="border-b border-slate-700/40">
          <CardTitle>Formandos ({formandos.length})</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="p-5 text-sm text-slate-500">A carregar…</div>
        ) : formandos.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">Sem matrículas activas nesta acção.</div>
        ) : (
          <>
          <TableScroll>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Formando</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Turma</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Presença</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Verificação</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">SIGO</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {paging.slice.map((f) => (
                  <tr key={f.matriculaId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-slate-200 font-medium">{f.formando.nome}</p>
                      <p className="text-xs text-slate-500">NIF {f.formando.nif}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{f.turmaCodigo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200">{f.taxaPresenca != null ? `${f.taxaPresenca}%` : "–"}</span>
                        <Badge variant={f.elegivelCertificado ? "green" : "yellow"}>
                          {f.elegivelCertificado ? "Elegível" : "Abaixo limiar"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {f.codigoVerificacao ? (
                        <code className="text-xs text-blue-300">{f.codigoVerificacao}</code>
                      ) : (
                        <span className="text-slate-600 text-xs">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {f.certificadoSigo ? (
                        <div className="space-y-1">
                          <Badge variant="purple">Oficial SIGO</Badge>
                          {f.certificadoSigo.numeroCertificado ? (
                            <p className="text-[10px] text-slate-500">{f.certificadoSigo.numeroCertificado}</p>
                          ) : null}
                          {f.certificadoSigo.temFicheiro ? (
                            <button
                              type="button"
                              onClick={() => downloadSigo(f.certificadoSigo!.id)}
                              className="block text-[11px] text-teal-400 hover:text-teal-300"
                            >
                              Descarregar PDF
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-600">PDF pendente</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" onClick={() => void imprimir(f.matriculaId)}>
                        <Download className="h-3 w-3" />
                        Imprimir / PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          {paging.total > 0 ? (
            <ListPaginationControls
              className="border-t border-slate-700/40 px-4 py-3"
              page={paging.page}
              pageSize={paging.pageSize}
              total={paging.total}
              numberedPages
              onPageChange={paging.setPage}
              onPageSizeChange={paging.setPageSize}
            />
          ) : null}
          </>
        )}
      </Card>
      </DgertTarget>
    </>
  );
}
