import { Injectable } from "@nestjs/common";
import type { RequestUser } from "../auth/types/access-token-payload";
import { DossiePedagogicoService } from "./dossie-pedagogico.service";
import { SigoExportService } from "./sigo-export.service";
import { validateSigoPayload } from "./sigo-validation.util";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

@Injectable()
export class DossieHtmlExportService {
  constructor(
    private readonly dossie: DossiePedagogicoService,
    private readonly sigo: SigoExportService,
  ) {}

  async buildPrintableHtml(user: RequestUser, acaoId: string) {
    const dossie = await this.dossie.getByAcaoFormacao(user, acaoId);
    const sigoPkg = await this.sigo.buildSigoJsonPackage(user, acaoId);
    const validacao = validateSigoPayload(sigoPkg.body as Parameters<typeof validateSigoPayload>[0]);

    const acao = dossie.acaoFormacao as Record<string, unknown>;
    const curso = dossie.curso as Record<string, unknown>;
    const tenantSlug = user.tenantSlug ?? "tenant";
    const codigo = String(acao.codigoInterno ?? "acao");
    const filename = `dossie-${tenantSlug}-${codigo}-${new Date().toISOString().slice(0, 10)}.html`;

    const sessoes = dossie.cronograma?.sessoes ?? [];
    const turmasRows = dossie.turmas
      .flatMap((t) =>
        t.matriculas.map(
          (m) =>
            `<tr><td>${escapeHtml(t.codigo)}</td><td>${escapeHtml(m.formando.nome)}</td><td>${escapeHtml(m.formando.nif)}</td><td>${escapeHtml(String(m.estado))}</td></tr>`,
        ),
      )
      .join("");

    const sessoesRows = sessoes
      .map((s) => {
        const sumOk = s.sumarios.some((x) => x.imutavel);
        const folha = s.folhasPresenca[0];
        const folhaOk = folha
          ? folha.fechadaEm || folha.validadaFormadorEm
            ? "Validada"
            : "Aberta"
          : "–";
        const inicioReal = s.iniciadaEm
          ? new Date(s.iniciadaEm).toLocaleString("pt-PT")
          : "–";
        const fimReal = s.terminadaEm
          ? new Date(s.terminadaEm).toLocaleString("pt-PT")
          : "–";
        const formadorNome = s.formador?.nomeCompleto ?? "–";
        const formadorPres =
          s.formadorPresente === true
            ? "Sim"
            : s.formadorPresente === false
              ? "Não"
              : "–";
        return `<tr>
          <td>S${s.numeroSessao}</td>
          <td>${escapeHtml(String(s.data).slice(0, 10))}</td>
          <td>${escapeHtml(s.horaInicio)}–${escapeHtml(s.horaFim)}</td>
          <td>${escapeHtml(inicioReal)}</td>
          <td>${escapeHtml(fimReal)}</td>
          <td>${escapeHtml(formadorNome)}</td>
          <td>${escapeHtml(formadorPres)}</td>
          <td>${escapeHtml(s.estado)}</td>
          <td>${sumOk ? "Sim" : "Não"}</td>
          <td>${escapeHtml(folhaOk)}${folha ? ` (${folha.presentes}/${folha.totalPresencas})` : ""}</td>
        </tr>`;
      })
      .join("");

    const errosLi = validacao.erros
      .map((e) => `<li class="err">${escapeHtml(e.mensagem)}</li>`)
      .join("");
    const avisosLi = validacao.avisos
      .map((a) => `<li class="warn">${escapeHtml(a.mensagem)}</li>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <title>Dossiê pedagógico – ${escapeHtml(codigo)}</title>
  <style>
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #111; margin: 2rem; line-height: 1.45; font-size: 11pt; }
    h1 { font-size: 1.35rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.05rem; margin-top: 1.35rem; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }
    .meta { color: #444; font-size: 0.9rem; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 10pt; }
    th, td { border: 1px solid #bbb; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #f0f0f0; }
    .err { color: #b91c1c; }
    .warn { color: #b45309; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600; }
    .ok { background: #dcfce7; color: #166534; }
    .bad { background: #fee2e2; color: #991b1b; }
    @media print {
      body { margin: 1cm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <p class="no-print" style="background:#eff6ff;padding:0.75rem;border-radius:6px;">
    <strong>Imprimir / PDF:</strong> Ctrl+P (ou Cmd+P) → «Guardar como PDF».
  </p>
  <h1>Dossiê pedagógico</h1>
  <p class="meta">
    ${escapeHtml(String(acao.titulo ?? ""))} · ${escapeHtml(codigo)}<br/>
    Entidade: ${escapeHtml(String((sigoPkg.body as { entidadeFormadora: { denominacao: string } }).entidadeFormadora.denominacao))}<br/>
    Gerado: ${escapeHtml(new Date().toISOString())} · Checklist DGERT: ${dossie.checklist.scorePercent}%
  </p>

  <h2>Validação SIGO</h2>
  <p>
    <span class="badge ${validacao.valido ? "ok" : "bad"}">${validacao.valido ? "Sem erros bloqueantes" : `${validacao.erros.length} erro(s)`}</span>
    ${validacao.avisos.length ? `<span class="badge" style="background:#fef3c7;color:#92400e;margin-left:0.35rem;">${validacao.avisos.length} aviso(s)</span>` : ""}
  </p>
  ${errosLi ? `<ul>${errosLi}</ul>` : "<p>Nenhum erro bloqueante.</p>"}
  ${avisosLi ? `<h3 style="font-size:0.95rem;">Avisos</h3><ul>${avisosLi}</ul>` : ""}

  <h2>Curso / UFCD</h2>
  <p><strong>${escapeHtml(String(curso.designacao ?? ""))}</strong><br/>
  UFCD: ${escapeHtml(String(curso.codigoUfcd ?? "–"))} · ${String(curso.cargaHoras)}h · ${escapeHtml(String(curso.modalidade ?? ""))}</p>
  <p>${escapeHtml(String(curso.objetivos ?? "–"))}</p>

  <h2>Acção de formação</h2>
  <p>Período: ${escapeHtml(String(acao.dataInicio).slice(0, 10))} → ${escapeHtml(String(acao.dataFim).slice(0, 10))} · Estado: ${escapeHtml(String(acao.estado ?? ""))}</p>

  <h2>Formandos matriculados</h2>
  <table>
    <thead><tr><th>Turma</th><th>Nome</th><th>NIF</th><th>Estado</th></tr></thead>
    <tbody>${turmasRows || "<tr><td colspan=\"4\">–</td></tr>"}</tbody>
  </table>

  <h2>Sessões e registo pedagógico</h2>
  <table>
    <thead><tr><th>Sessão</th><th>Data</th><th>Horário planeado</th><th>Início efectivo</th><th>Fim efectivo</th><th>Formador</th><th>Form. presente</th><th>Estado</th><th>Sumário</th><th>Folha presença</th></tr></thead>
    <tbody>${sessoesRows || "<tr><td colspan=\"10\">–</td></tr>"}</tbody>
  </table>

  <h2>Assiduidade</h2>
  <p>Taxa global: ${dossie.assiduidade.taxaPresenca != null ? `${dossie.assiduidade.taxaPresenca}%` : "–"} (${dossie.assiduidade.presencasMarcadas}/${dossie.assiduidade.presencasRegistadas} registos)</p>

  <p class="meta" style="margin-top:2rem;font-size:0.8rem;">
    Documento gerado por NexiForma – não substitui arquivo oficial SIGO/DGERT.
  </p>
</body>
</html>`;

    return { filename, html };
  }
}
