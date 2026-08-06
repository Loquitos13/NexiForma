import {
  computeCertificadoTokenExpiresAt,
  isCertificadoTokenExpired,
  resolveCertificadoVerificacaoTtlDays,
} from "./certificado-verificacao-ttl.util";

describe("certificado-verificacao-ttl", () => {
  it("default TTL 365", () => {
    expect(resolveCertificadoVerificacaoTtlDays(undefined)).toBe(365);
    expect(resolveCertificadoVerificacaoTtlDays("")).toBe(365);
  });

  it("aceita 0 (sem expiração)", () => {
    expect(resolveCertificadoVerificacaoTtlDays("0")).toBe(0);
    expect(computeCertificadoTokenExpiresAt(new Date("2026-01-01T00:00:00Z"), 0)).toBeNull();
  });

  it("calcula expiresAt", () => {
    const from = new Date("2026-01-01T12:00:00.000Z");
    expect(computeCertificadoTokenExpiresAt(from, 10)?.toISOString()).toBe(
      "2026-01-11T12:00:00.000Z",
    );
  });

  it("expira com tokenExpiresAt explícito", () => {
    expect(
      isCertificadoTokenExpired({
        emitidoEm: new Date("2026-01-01T00:00:00Z"),
        tokenExpiresAt: new Date("2026-06-01T00:00:00Z"),
        ttlDays: 365,
        now: new Date("2026-07-01T00:00:00Z"),
      }),
    ).toBe(true);
  });

  it("grandfather: null expiresAt usa emitidoEm + ttl", () => {
    expect(
      isCertificadoTokenExpired({
        emitidoEm: new Date("2024-01-01T00:00:00Z"),
        tokenExpiresAt: null,
        ttlDays: 365,
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    ).toBe(true);
  });
});
