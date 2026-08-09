import { describe, expect, it } from "vitest";
import {
  FATURA_TEMPLATE_CORES_DEFAULT,
  faturaHeaderBackground,
  mergeFaturaTemplateCoresMetadata,
  parseFaturaTemplateCores,
} from "./fatura-template-cores.util";

describe("fatura-template-cores.util", () => {
  it("usa defaults sem metadata", () => {
    expect(parseFaturaTemplateCores(null)).toEqual(FATURA_TEMPLATE_CORES_DEFAULT);
  });

  it("aceita hex válidos e rejeita inválidos", () => {
    const cores = parseFaturaTemplateCores({
      faturacao: {
        templateCores: {
          headerMode: "solid",
          headerFrom: "#112233",
          accent: "vermelho",
          border: "#ABCDEF",
        },
      },
    });
    expect(cores.headerMode).toBe("solid");
    expect(cores.headerFrom).toBe("#112233");
    expect(cores.accent).toBe(FATURA_TEMPLATE_CORES_DEFAULT.accent);
    expect(cores.border).toBe("#abcdef");
  });

  it("faz merge no metadata do tenant", () => {
    const next = mergeFaturaTemplateCoresMetadata(
      { branding: { x: 1 } },
      { accent: "#00aa00", headerMode: "solid" },
    );
    expect((next as { branding: unknown }).branding).toEqual({ x: 1 });
    const cores = (next as { faturacao: { templateCores: { accent: string; headerMode: string } } })
      .faturacao.templateCores;
    expect(cores.accent).toBe("#00aa00");
    expect(cores.headerMode).toBe("solid");
  });

  it("persiste headerMode solid após round-trip (incl. objecto tipo DTO)", () => {
    class FakeDto {
      headerMode = "solid" as const;
      headerFrom = "#42a4ff";
      headerVia = "#34ea61";
      headerTo = "#930b6f";
      accent = "#047c1c";
      surface = "#f5f3ff";
      border = "#ddd6fe";
    }
    const merged = mergeFaturaTemplateCoresMetadata({}, new FakeDto());
    const parsed = parseFaturaTemplateCores(merged);
    expect(parsed.headerMode).toBe("solid");
    expect(parsed.headerFrom).toBe("#42a4ff");
    expect(faturaHeaderBackground(parsed)).toBe("#42a4ff");
  });

  it("resolve fundo sólido ou gradiente", () => {
    const solid = parseFaturaTemplateCores({
      faturacao: { templateCores: { headerMode: "solid", headerFrom: "#112233" } },
    });
    expect(faturaHeaderBackground(solid)).toBe("#112233");
    const grad = parseFaturaTemplateCores({
      faturacao: { templateCores: { headerMode: "gradient" } },
    });
    expect(faturaHeaderBackground(grad)).toContain("linear-gradient");
  });
});
