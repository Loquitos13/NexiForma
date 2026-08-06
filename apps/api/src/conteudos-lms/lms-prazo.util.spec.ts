import {
  prazoConclusaoAtingido,
  prazoYmd,
  ymdInTimeZone,
} from "./lms-prazo.util";

describe("lms-prazo.util", () => {
  it("ymdInTimeZone formata em Europe/Lisbon", () => {
    // 2026-08-09 23:30 UTC = 2026-08-10 00:30 em Lisboa (UTC+1 verão)
    const d = new Date("2026-08-09T23:30:00.000Z");
    expect(ymdInTimeZone(d, "Europe/Lisbon")).toBe("2026-08-10");
  });

  it("prazoYmd normaliza Date e string", () => {
    expect(prazoYmd("2026-08-10")).toBe("2026-08-10");
    expect(prazoYmd(new Date("2026-08-10T00:00:00.000Z"))).toBe("2026-08-10");
  });

  it("atingido a partir das 00:00 locais do dia seguinte ao prazo", () => {
    const prazo = "2026-08-23";
    // 23 Ago ainda dentro do prazo
    expect(prazoConclusaoAtingido(prazo, new Date("2026-08-23T10:00:00.000Z"))).toBe(false);
    // 23 Ago 23:30 Lisboa (UTC+1) ≈ 22:30 UTC - ainda válido
    expect(prazoConclusaoAtingido(prazo, new Date("2026-08-23T22:30:00.000Z"))).toBe(false);
    // 24 Ago 00:05 Lisboa ≈ 2026-08-23T23:05Z - bloqueado
    expect(prazoConclusaoAtingido(prazo, new Date("2026-08-23T23:05:00.000Z"))).toBe(true);
    expect(prazoConclusaoAtingido(prazo, new Date("2026-08-24T10:00:00.000Z"))).toBe(true);
  });
});
