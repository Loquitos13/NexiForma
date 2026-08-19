import { extractDownloadablesFromAttrs, isInquiryPassed } from "./persona-id-files.util";

describe("persona-id-files.util", () => {
  it("detecta inquiry aprovada", () => {
    expect(isInquiryPassed("approved")).toBe(true);
    expect(isInquiryPassed("pending")).toBe(false);
  });

  it("extrai photo-urls frente e verso", () => {
    const files = extractDownloadablesFromAttrs({
      "photo-urls": [
        { page: "front", url: "https://example.com/f.jpg" },
        { page: "back", url: "https://example.com/b.jpg" },
      ],
    });
    expect(files).toHaveLength(2);
    expect(files[0]?.page).toBe("front");
  });

  it("não duplica verso quando photo-urls e back-photo-url coexistem", () => {
    const files = extractDownloadablesFromAttrs({
      "photo-urls": [
        { page: "front", url: "https://example.com/f.jpg" },
        { page: "back", url: "https://example.com/b.jpg" },
      ],
      "back-photo-url": "https://example.com/b.jpg",
    });
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.page)).toEqual(["front", "back"]);
  });
});
