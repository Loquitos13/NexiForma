import { BadRequestException } from "@nestjs/common";
import { assertValidUuid, isValidUuid } from "./uuid.util";

describe("uuid.util", () => {
  it("accepts valid UUID v4", () => {
    expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(assertValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("rejects SQL injection payloads", () => {
    expect(isValidUuid("'; DROP TABLE users; --")).toBe(false);
    expect(() => assertValidUuid("1 OR 1=1", "tenantId")).toThrow(BadRequestException);
  });

  it("trims whitespace", () => {
    expect(assertValidUuid(" 550e8400-e29b-41d4-a716-446655440000 ")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });
});
