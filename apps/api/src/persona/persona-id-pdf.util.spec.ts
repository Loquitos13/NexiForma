import { orderPersonaIdFiles, computeImageFitOnPage } from "./persona-id-pdf.util";

describe("orderPersonaIdFiles", () => {
  it("ordena frente antes de verso", () => {
    const ordered = orderPersonaIdFiles([
      { page: "back", id: 2 },
      { page: "front", id: 1 },
    ]);
    expect(ordered.map((f) => f.page)).toEqual(["front", "back"]);
  });
});

describe("computeImageFitOnPage", () => {
  it("encolhe imagem grande para caber em A4 com margem", () => {
    const fit = computeImageFitOnPage({ imageWidth: 4000, imageHeight: 3000 });
    expect(fit.width).toBeLessThanOrEqual(595.28 - 80);
    expect(fit.height).toBeLessThanOrEqual(841.89 - 80);
    expect(fit.x).toBeGreaterThanOrEqual(0);
    expect(fit.y).toBeGreaterThanOrEqual(0);
  });
});
