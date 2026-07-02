import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveProjectPath } from "./env-paths";

describe("resolveProjectPath", () => {
  it("resolve ./certs a partir da raiz do monorepo quando cwd é apps/api", () => {
    const monorepoRoot = resolve(__dirname, "..", "..", "..", "..");
    const certAtRoot = resolve(monorepoRoot, "certs", "at-public-key.pem");
    if (!existsSync(certAtRoot)) {
      return;
    }

    const previousCwd = process.cwd();
    process.chdir(resolve(monorepoRoot, "apps", "api"));
    try {
      expect(resolveProjectPath("./certs/at-public-key.pem")).toBe(certAtRoot);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
