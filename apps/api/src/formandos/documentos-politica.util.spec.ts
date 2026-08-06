import {
  parseConfiguracaoMatriculaDocs,
  parseTenantDocumentosPolitica,
  resolveDocumentosPolitica,
} from "./documentos-politica.util";

describe("documentos-politica.util", () => {
  it("usa defaults do tenant", () => {
    const p = parseTenantDocumentosPolitica(null);
    expect(p.universaisObrigatorios).toEqual([
      "documento_identificacao",
      "certificado_habilitacoes",
      "comprovativo_iban",
    ]);
  });

  it("resolve prioridade acao > curso > tenant", () => {
    const r = resolveDocumentosPolitica({
      tenantMetadata: {
        documentosPolitica: { version: 1, universaisObrigatorios: ["cv"] },
      },
      cursoConfig: {
        version: 1,
        inscricaoObrigatorios: ["contrato_formacao"],
        universaisObrigatorios: ["cv", "documento_identificacao"],
      },
      acaoConfig: {
        version: 1,
        inscricaoObrigatorios: ["contrato_formacao", "regulamento_formacao"],
      },
    });
    expect(r.inscricaoObrigatorios).toEqual(["contrato_formacao", "regulamento_formacao"]);
    expect(r.universaisObrigatorios).toEqual(["cv", "documento_identificacao"]);
    expect(r.origemInscricao).toBe("acao");
    expect(r.origemUniversais).toBe("curso");
  });

  it("parse config inválida devolve null", () => {
    expect(parseConfiguracaoMatriculaDocs({ foo: 1 })).toBeNull();
  });
});
