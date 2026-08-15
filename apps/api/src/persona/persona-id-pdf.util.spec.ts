import { orderPersonaIdFiles } from "./persona-id-pdf.util";

describe("orderPersonaIdFiles", () => {
  it("ordena frente antes de verso", () => {
    const ordered = orderPersonaIdFiles([
      { page: "back", id: 2 },
      { page: "front", id: 1 },
    ]);
    expect(ordered.map((f) => f.page)).toEqual(["front", "back"]);
  });
});
