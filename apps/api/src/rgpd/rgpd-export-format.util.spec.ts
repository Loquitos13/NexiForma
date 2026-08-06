import { parseRgpdExportFormat, serializeRgpdExport } from "./rgpd-export-format.util";

describe("rgpd-export-format", () => {
  it("normaliza formato", () => {
    expect(parseRgpdExportFormat("CSV")).toBe("csv");
    expect(parseRgpdExportFormat("xyz")).toBe("json");
  });

  it("serializa csv com chaves planas", () => {
    const { body, extension } = serializeRgpdExport(
      { tipo: "utilizador", dados: { email: "a@b.c" } },
      "csv",
    );
    expect(extension).toBe("csv");
    const text = body.toString("utf8");
    expect(text).toContain("chave,valor");
    expect(text).toContain("tipo,utilizador");
    expect(text).toContain("dados.email,a@b.c");
  });

  it("serializa txt", () => {
    const { contentType, extension } = serializeRgpdExport({ ok: true }, "txt");
    expect(extension).toBe("txt");
    expect(contentType).toContain("text/plain");
  });
});
