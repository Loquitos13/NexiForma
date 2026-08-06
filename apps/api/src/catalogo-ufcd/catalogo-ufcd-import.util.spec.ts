import * as XLSX from "xlsx";
import {
  CATALOGO_UFCD_FONTES,
  parseUfcdImportCsv,
  parseUfcdImportJson,
  parseUfcdImportXlsx,
  splitDelimitedLine,
} from "./catalogo-ufcd-import.util";

describe("catalogo-ufcd-import.util", () => {
  it("expõe fontes oficiais CNQ/ANQEP", () => {
    expect(CATALOGO_UFCD_FONTES.cnqUfcdPesquisa).toContain("catalogo.anqep.gov.pt");
    expect(CATALOGO_UFCD_FONTES.cnqUfcdPesquisaAlt).toContain("catalogo.snq.gov.pt");
    expect(CATALOGO_UFCD_FONTES.anqepHome).toContain("anqep.gov.pt");
  });

  it("splitDelimitedLine respeita aspas", () => {
    expect(splitDelimitedLine('0113;"Higiene, segurança";Turismo;25;3', ";")).toEqual([
      "0113",
      "Higiene, segurança",
      "Turismo",
      "25",
      "3",
    ]);
  });

  it("parseia CSV CNQ com cabeçalhos PT e ponto-e-vírgula", () => {
    const csv = [
      "Código;Designação;Área de Educação e Formação;Duração;Nível QNQ",
      "0113;Higiene e segurança alimentar;Turismo;25;3",
      "0374;Excelência operacional;Gestão;50 h;4",
    ].join("\n");
    const r = parseUfcdImportCsv(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      codigo: "0113",
      designacao: "Higiene e segurança alimentar",
      area: "Turismo",
      cargaHoras: 25,
      nivelQnq: "3",
    });
    expect(r.rows[1]!.cargaHoras).toBe(50);
  });

  it("aceita ficheiro sem cabeçalho", () => {
    const csv = "0489;Comunicação e atendimento;Serviços;25;3";
    const r = parseUfcdImportCsv(csv);
    expect(r.rows[0]!.codigo).toBe("0489");
  });

  it("omite códigos inválidos e duplicados", () => {
    const csv = [
      "codigo;designacao",
      "abc;Inválido",
      "0113;Ok",
      "0113;Duplicado",
    ].join("\n");
    const r = parseUfcdImportCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.skipped.length).toBeGreaterThanOrEqual(2);
  });

  it("parseia JSON", () => {
    const rows = parseUfcdImportJson({
      rows: [{ codigo: "0113", designacao: "Teste", cargaHoras: 25 }],
    });
    expect(rows).toHaveLength(1);
  });

  it("parseia Excel .xlsx no formato da listagem CNQ", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Código", "Designação", "Área de Educação e Formação", "Duração", "Nível QNQ"],
      [113, "Higiene e segurança alimentar", "Turismo", 25, 3],
      ["0374", "Excelência operacional", "Gestão", "50", "4"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "UFCD");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const r = parseUfcdImportXlsx(buf);
    expect(r.format).toBe("xlsx");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      codigo: "0113",
      designacao: "Higiene e segurança alimentar",
      cargaHoras: 25,
      nivelQnq: "3",
    });
    expect(r.rows[1]!.codigo).toBe("0374");
  });

  it("parseia cabeçalhos reais ListaUFCDs CNQ (Código UFCD + UFCD)", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Código UFCD",
        "UFCD",
        "Carga Horária UFCD",
        "Componente",
        "Código Área de Formação",
        "Designação Área de Formação",
        "Código Qualificação",
        "Qualificação",
        "Nível QNQ",
        "Nível QEQ",
      ],
      [
        "0066",
        "Execução de cartonagem (capa dura) - bitola e preparação da cola",
        "25",
        "Tecnológica",
        "213",
        "Audiovisuais e Produção dos Media",
        "213003",
        "Operador/a Gráfico de Acabamentos",
        "2",
        "2",
      ],
      // mesma UFCD noutra qualificação  deve ser deduplicada
      [
        "0066",
        "Execução de cartonagem (capa dura) - bitola e preparação da cola",
        "25",
        "Tecnológica",
        "213",
        "Audiovisuais e Produção dos Media",
        "213999",
        "Outra qualificação",
        "2",
        "2",
      ],
      [
        "0137",
        "Desenho vetorial - criação e manipulação de imagens",
        "50",
        "Tecnológica",
        "543",
        "Materiais",
        "543134",
        "Técnico/a de Modelação Cerâmica",
        "4",
        "4",
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "UFCD");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const r = parseUfcdImportXlsx(buf);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({
      codigo: "0066",
      designacao: "Execução de cartonagem (capa dura) - bitola e preparação da cola",
      area: "Audiovisuais e Produção dos Media",
      cargaHoras: 25,
      nivelQnq: "2",
    });
    expect(r.skipped.some((s) => s.reason.includes("duplicado"))).toBe(true);
  });
});
