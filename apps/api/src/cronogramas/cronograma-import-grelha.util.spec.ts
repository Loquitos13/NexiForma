import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  embedPdfLayout,
  extractPdfLayoutFromTexto,
  extrairSessoesDeGrelhaPdf,
  type PdfLayoutItem,
} from "./cronograma-import-grelha.util";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures/cronograma-vng-layout.json"), "utf8"),
) as { items: PdfLayoutItem[] };

describe("cronograma-import-grelha", () => {
  it("embute e extrai layout do texto", () => {
    const embedded = embedPdfLayout("linha legenda\n", [{ s: "M1", x: 10, y: 20 }]);
    const { items, textoPlano } = extractPdfLayoutFromTexto(embedded);
    expect(items).toEqual([{ s: "M1", x: 10, y: 20 }]);
    expect(textoPlano).toContain("linha legenda");
  });

  it("só cria sessões de consolidação (presencial + síncronas)", () => {
    const draft = extrairSessoesDeGrelhaPdf(fixture.items, { modulos: [] });

    expect(draft.sessoes.length).toBeGreaterThanOrEqual(8);
    expect(draft.sessoes.length).toBeLessThanOrEqual(14);
    expect(draft.legendaResumo).toMatch(/M1/i);
    expect(draft.prazoConclusaoLms).toBe("2026-09-17");

    // Auto-aprendizagem não vira sessão; vira prazo LMS por módulo
    expect(draft.sessoes.every((s) => !s.assincrona)).toBe(true);
    expect(draft.prazosModulos.length).toBeGreaterThanOrEqual(4);
    expect(draft.prazosModulos.some((p) => p.moduloCodigo === "M1")).toBe(true);
    expect(draft.avisos.some((a) => /prazo/i.test(a))).toBe(true);

    const presencial = draft.sessoes.filter((s) => s.modalidade === "presencial");
    expect(presencial.some((s) => s.data === "2026-08-17" && s.horaInicio === "11:00")).toBe(true);
    expect(presencial.some((s) => s.data === "2026-08-24" && s.horaInicio === "09:00")).toBe(true);
    // M3+M4 empilhados → uma sessão presencial (não “online”)
    const m34 = presencial.filter((s) => s.data === "2026-08-26");
    expect(m34.length).toBe(1);
    expect(m34[0]?.tituloModulo).toMatch(/3.*4|M3/i);

    const sync = draft.sessoes.filter(
      (s) => s.modalidade === "online" && s.horaInicio === "10:00",
    );
    expect(sync.length).toBe(2);
    expect(sync.every((s) => /v[ií]deo|s[ií]ncron/i.test(s.tituloModulo ?? s.notas ?? ""))).toBe(
      true,
    );
  });
});
