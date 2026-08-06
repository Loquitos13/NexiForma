import { describe, expect, it } from "vitest";
import * as argon2 from "argon2";
import { matchPasswordHash } from "./shared-password.util";

describe("shared-password.util", () => {
  it("matchPasswordHash finds a matching hash among several", async () => {
    const a = await argon2.hash("senha-a", { type: argon2.argon2id });
    const b = await argon2.hash("senha-b", { type: argon2.argon2id });
    expect(await matchPasswordHash([a, b, null], "senha-b")).toBe(b);
    expect(await matchPasswordHash([a, b], "errada")).toBeNull();
  });
});
