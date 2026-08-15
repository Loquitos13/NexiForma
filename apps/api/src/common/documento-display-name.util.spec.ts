import { buildDocumentoDisplayName } from "./documento-display-name.util";

describe("buildDocumentoDisplayName", () => {
  it("adiciona extensão PDF quando em falta", () => {
    expect(
      buildDocumentoDisplayName({
        nome: "Certificado UFCD Gestão",
        originalFilename: "scan.pdf",
        mimeType: "application/pdf",
      }),
    ).toBe("Certificado UFCD Gestão.pdf");
  });

  it("rejeita nomes genéricos", () => {
    expect(() =>
      buildDocumentoDisplayName({
        nome: "documento",
        originalFilename: "a.pdf",
        mimeType: "application/pdf",
      }),
    ).toThrow(/descritivo/);
  });
});
