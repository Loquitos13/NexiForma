import { buildSaftPtXml } from "./saft-pt-export.util";

describe("buildSaftPtXml", () => {
  it("gera XML SAF-T com fatura emitida", () => {
    const xml = buildSaftPtXml({
      nifEmitente: "500123456",
      nomeEmpresa: "Entidade Teste Lda",
      softwareCertificado: "1234",
      productCompanyTaxId: "999999990",
      periodoInicio: new Date("2026-01-01"),
      periodoFim: new Date("2026-01-31"),
      faturas: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          numero: 1,
          codigoAtcud: "ABCD1234-1",
          estado: "EMITIDA",
          dataEmissao: new Date("2026-01-15T10:00:00Z"),
          valorCentavos: 12300,
          ivaCentavos: 2300,
          destinatarioNome: "Cliente SA",
          destinatarioNif: "501234567",
          serieCodigo: "2026",
          serieTipo: "FT",
          linhas: [
            {
              descricao: "Formação",
              quantidade: 1,
              precoUnitCentavos: 10000,
              taxaIva: 23,
              valorIvaCentavos: 2300,
            },
          ],
        },
      ],
    });

    expect(xml).toContain('xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01"');
    expect(xml).toContain("<CompanyID>500123456</CompanyID>");
    expect(xml).toContain("<NumberOfEntries>1</NumberOfEntries>");
    expect(xml).toContain("FT 2026/1");
  });
});
