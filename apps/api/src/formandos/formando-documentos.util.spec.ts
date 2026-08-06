import {
  avaliarDocumentosObrigatorios,
  identificacaoCompleta,
  normalizarLadoDocumento,
} from "./formando-documentos.util";

describe("formando-documentos.util", () => {
  it("identificação completa com PDF unico", () => {
    expect(
      identificacaoCompleta([{ categoria: "documento_identificacao", lado: "unico" }]),
    ).toBe(true);
  });

  it("identificação completa com frente+verso", () => {
    expect(
      identificacaoCompleta([
        { categoria: "documento_identificacao", lado: "frente" },
        { categoria: "documento_identificacao", lado: "verso" },
      ]),
    ).toBe(true);
  });

  it("identificação completa com CC legado", () => {
    expect(
      identificacaoCompleta([
        { categoria: "cc", lado: "frente" },
        { categoria: "cc", lado: "verso" },
      ]),
    ).toBe(true);
  });

  it("avalia obrigatórios universais", () => {
    const r = avaliarDocumentosObrigatorios(
      [
        { categoria: "cv", lado: "unico" },
        { categoria: "certificado_habilitacoes", lado: "frente" },
        { categoria: "documento_identificacao", lado: "unico" },
      ],
      ["cv", "documento_identificacao", "certificado_habilitacoes", "certidao_grau", "domicilio_fiscal"],
    );
    expect(r.completo).toBe(false);
    expect(r.emFalta).toEqual(["certidao_grau", "domicilio_fiscal"]);
  });

  it("respeita lista obrigatória do tenant", () => {
    const r = avaliarDocumentosObrigatorios(
      [{ categoria: "cv", lado: "unico" }],
      ["cv"],
    );
    expect(r.completo).toBe(true);
    expect(r.emFalta).toEqual([]);
  });

  it("normaliza lados", () => {
    expect(normalizarLadoDocumento("domicilio_fiscal", "verso")).toBe("frente");
    expect(normalizarLadoDocumento("cv", "unico")).toBe("unico");
    expect(normalizarLadoDocumento("documento_identificacao", "unico")).toBe("unico");
    expect(normalizarLadoDocumento("cc", "verso")).toBe("verso");
  });
});
