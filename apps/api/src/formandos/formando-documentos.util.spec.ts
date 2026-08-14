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
        { categoria: "certificado_habilitacoes", lado: "frente" },
        { categoria: "documento_identificacao", lado: "unico" },
        { categoria: "declaracao_entidade_patronal", lado: "unico" },
        { categoria: "domicilio_fiscal", lado: "unico" },
      ],
      [
        "documento_identificacao",
        "certificado_habilitacoes",
        "declaracao_entidade_patronal",
        "domicilio_fiscal",
        "comprovativo_iban",
      ],
    );
    expect(r.completo).toBe(false);
    expect(r.emFalta).toEqual(["comprovativo_iban"]);
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
