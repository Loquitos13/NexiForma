import { describe, expect, it } from "vitest";
import {
  formadorIniciais,
  formadorNomeBadge,
  formadorNomeCurto,
  formadorSubtitulo,
} from "./formador-display";

describe("formador-display", () => {
  it("nome curto usa primeiro e último", () => {
    expect(formadorNomeCurto("Ana Maria Rodrigues")).toBe("Ana Rodrigues");
    expect(formadorNomeCurto("João Ferreira")).toBe("João Ferreira");
  });

  it("iniciais", () => {
    expect(formadorIniciais("João Ferreira")).toBe("JF");
    expect(formadorIniciais("Ana")).toBe("AN");
  });

  it("subtitulo prefer CCP", () => {
    expect(formadorSubtitulo({ ccpNumero: "123", email: "a@b.pt" })).toBe("CCP 123");
    expect(formadorSubtitulo({ email: "a@b.pt" })).toBe("a@b.pt");
  });

  it("badge usa nome completo com homónimos", () => {
    const nomes = ["Ana Silva Costa", "Ana Maria Costa"];
    expect(formadorNomeBadge("Ana Silva Costa", nomes)).toBe("Ana Silva Costa");
    expect(formadorNomeBadge("Ana Silva Costa", ["Ana Silva Costa", "João Ferreira"])).toBe(
      "Ana Costa",
    );
  });
});
