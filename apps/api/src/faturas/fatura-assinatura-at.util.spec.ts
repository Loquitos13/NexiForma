import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assinarDocumentoFaturaAt,
  formatarAtInvoiceNo,
  montarPayloadAssinaturaAt,
  verificarAssinaturaDocumentoFaturaAt,
} from "./fatura-assinatura-at.util";

const repoRoot = join(__dirname, "../../../..");
const privateKeyPath = join(repoRoot, "chaveprivada.txt");
const publicKeyPath = join(repoRoot, "chavepublica.txt");

describe("fatura-assinatura-at.util", () => {
  it("monta payload AT com separadores e grossTotal 0.00", () => {
    expect(
      montarPayloadAssinaturaAt({
        invoiceDate: new Date("2017-11-29T00:00:00Z"),
        systemEntryDate: new Date("2017-11-29T22:34:23Z"),
        invoiceNo: "FT ZAF/1",
        grossTotalCentavos: 2807,
        hashDocumentoAnterior: null,
      }),
    ).toBe("2017-11-29;2017-11-29T22:34:23;FT ZAF/1;28.07;");
  });

  it("formata número documento como no SAF-T", () => {
    expect(formatarAtInvoiceNo("FT", "2026", 1)).toBe("FT 2026/1");
  });

  const hasDemoKeys = existsSync(privateKeyPath) && existsSync(publicKeyPath);
  const demoIt = hasDemoKeys ? it : it.skip;

  demoIt("reproduz hash oficial do SAFT_I DEMO (FT ZAF/1)", () => {
    const privateKey = readFileSync(privateKeyPath, "utf8");
    const publicKey = readFileSync(publicKeyPath, "utf8");
    const expected =
      "dN0mi1g2EmZxFnSM3Z/01Up/1+Ot7rlaBJOLyfgPLAl3q0w4mFIcXwV/ZUQRP+8SPhoU0GqxbEfBEJLt6HMz4YD3hqnBHzxBvETYSK4iKP1euzjE2bSYO179BQBVXcqWEzWM2q028dOa5/ZXeCNHcHPf0xdqxddO8NaZFphwOe8=";

    const input = {
      invoiceDate: new Date("2017-11-29T00:00:00Z"),
      systemEntryDate: new Date("2017-11-29T22:34:23Z"),
      invoiceNo: "FT ZAF/1",
      grossTotalCentavos: 2807,
      hashDocumentoAnterior: null,
    };

    const assinatura = assinarDocumentoFaturaAt(privateKey, input);
    expect(assinatura).toBe(expected);
    expect(assinatura).toHaveLength(172);
    expect(verificarAssinaturaDocumentoFaturaAt(publicKey, input, assinatura)).toBe(true);
  });
});
