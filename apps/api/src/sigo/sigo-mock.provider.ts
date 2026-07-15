import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { SigoCertificadoRemoto } from "@nexiforma/shared";
import type { SigoRemoteStatus } from "./sigo-response.util";

type MockFormando = {
  nif: string;
  nome: string;
  matriculaId?: string | null;
};

type MockSubmission = {
  referenceId: string;
  submittedAt: Date;
  reconcileCount: number;
  formandos: MockFormando[];
  acaoCodigo: string;
};

/** PDF mínimo válido para testes de download SIGO. */
const MOCK_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n" +
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n" +
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>endobj\n" +
    "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n" +
    "trailer<< /Root 1 0 R /Size 4 >>\nstartxref\n178\n%%EOF\n",
);

@Injectable()
export class SigoMockProvider {
  private readonly store = new Map<string, MockSubmission>();

  register(referenceId: string, body: Record<string, unknown>): void {
    const acao = body.acaoFormacao as { codigoInterno?: string; codigo?: string } | undefined;
    const formandosRaw =
      (body.formandos as MockFormando[] | undefined) ??
      ((body as { dgeec?: { formandos?: MockFormando[] } }).dgeec?.formandos ?? []);

    const formandos = formandosRaw.map((f) => ({
      nif: String(f.nif ?? "").replace(/\D/g, ""),
      nome: String(f.nome ?? "Formando"),
      matriculaId:
        (f as { matriculaId?: string }).matriculaId ??
        (f as { matriculaExternaId?: string }).matriculaExternaId ??
        null,
    }));

    this.store.set(referenceId, {
      referenceId,
      submittedAt: new Date(),
      reconcileCount: 0,
      formandos,
      acaoCodigo: acao?.codigoInterno ?? acao?.codigo ?? "ACAO",
    });
  }

  getStatus(referenceId: string): SigoRemoteStatus {
    const row = this.store.get(referenceId);
    if (!row) {
      return { estado: "ERRO", erros: [{ mensagem: "Submissão mock não encontrada." }] };
    }
    if (row.reconcileCount === 0) {
      return { estado: "SUBMETIDA", erros: [], mensagem: "Aguarda reconciliação (mock)." };
    }
    return { estado: "ACEITE", erros: [], mensagem: "Aceite pela SIGO (mock)." };
  }

  markReconciled(referenceId: string): SigoRemoteStatus {
    const row = this.store.get(referenceId);
    if (!row) {
      return { estado: "ERRO", erros: [{ mensagem: "Submissão mock não encontrada." }] };
    }
    row.reconcileCount += 1;
    return this.getStatus(referenceId);
  }

  listCertificados(referenceId: string): SigoCertificadoRemoto[] {
    const row = this.store.get(referenceId);
    if (!row || row.reconcileCount < 1) return [];

    const emitidoEm = new Date().toISOString();
    return row.formandos.map((f) => {
      const certId = `mock-cert-${f.nif || randomUUID().slice(0, 8)}`;
      return {
        referencia: certId,
        nif: f.nif.length === 9 ? f.nif : null,
        nome: f.nome,
        numeroCertificado: `SIGO-MOCK-${row.acaoCodigo}-${f.nif}`,
        estado: "DISPONIVEL" as const,
        emitidoEm,
        downloadPath: `/certificados/${certId}/download`,
        matriculaId: f.matriculaId ?? null,
      };
    });
  }

  downloadCertificado(certificadoId: string): { body: Buffer; contentType: string } {
    return { body: MOCK_PDF, contentType: "application/pdf" };
  }

  ping(): { ok: true; mode: "mock"; submissions: number } {
    return { ok: true, mode: "mock", submissions: this.store.size };
  }
}
