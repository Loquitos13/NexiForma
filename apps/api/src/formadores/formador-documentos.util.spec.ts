import {
  avaliarDocumentosObrigatoriosFormador,
  resolveFormadorObrigatorios,
} from "./formador-documentos.util";

describe("formador-documentos.util", () => {
  it("resolve universais compatíveis + documentos do cargo", () => {
    expect(
      resolveFormadorObrigatorios([
        "cv",
        "documento_identificacao",
        "certificado_habilitacoes",
        "domicilio_fiscal",
      ]),
    ).toEqual([
      "cv",
      "documento_identificacao",
      "ccp",
      "certificados_formacao",
      "ficha_dgert",
    ]);
  });

  it("usa defaults quando tenant não tem universais compatíveis", () => {
    expect(resolveFormadorObrigatorios(["certidao_grau"])).toEqual([
      "cv",
      "documento_identificacao",
      "ccp",
      "certificados_formacao",
      "ficha_dgert",
    ]);
  });

  it("avalia em falta quando nDocs = 0", () => {
    const r = avaliarDocumentosObrigatoriosFormador([], ["cv", "documento_identificacao"]);
    expect(r.completo).toBe(false);
    expect(r.totalDocumentos).toBe(0);
    expect(r.emFalta).toEqual([
      "cv",
      "documento_identificacao",
      "ccp",
      "certificados_formacao",
      "ficha_dgert",
    ]);
  });

  it("completo quando universais + cargo estão carregados", () => {
    const r = avaliarDocumentosObrigatoriosFormador(
      [
        { categoria: "cv" },
        { categoria: "documento_identificacao" },
        { categoria: "ccp" },
        { categoria: "certificados_formacao" },
        { categoria: "ficha_dgert" },
      ],
      ["cv", "documento_identificacao"],
    );
    expect(r.completo).toBe(true);
    expect(r.emFalta).toEqual([]);
  });
});
