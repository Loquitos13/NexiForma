import {
  hhMmToMinutes,
  presentePorMinutos,
  sessaoDuracaoMinutos,
  totalSegundosLms,
} from "./assiduidade-lms.util";

describe("assiduidade-lms.util", () => {
  it("calcula duração da sessão", () => {
    expect(sessaoDuracaoMinutos("09:00", "12:30")).toBe(210);
  });

  it("soma segundos LMS com par join/leave", () => {
    const s = totalSegundosLms([
      { evento: "join", duracaoSegundos: null, ocorridoEm: "2026-05-29T09:00:00Z" },
      { evento: "leave", duracaoSegundos: 1800, ocorridoEm: "2026-05-29T09:30:00Z" },
    ]);
    expect(s).toBe(1800);
  });

  it("calcula intervalo quando leave não traz duracaoSegundos", () => {
    const s = totalSegundosLms([
      { evento: "join", duracaoSegundos: null, ocorridoEm: "2026-05-29T09:00:00Z" },
      { evento: "leave", duracaoSegundos: null, ocorridoEm: "2026-05-29T09:15:00Z" },
    ]);
    expect(s).toBe(900);
  });

  it("ignora heartbeats legados", () => {
    const s = totalSegundosLms([
      { evento: "join", duracaoSegundos: null, ocorridoEm: "2026-05-29T09:00:00Z" },
      { evento: "heartbeat", duracaoSegundos: null, ocorridoEm: "2026-05-29T09:01:00Z" },
      { evento: "leave", duracaoSegundos: 600, ocorridoEm: "2026-05-29T09:10:00Z" },
    ]);
    expect(s).toBe(600);
  });

  it("marca presente quando minutos >= limiar", () => {
    expect(presentePorMinutos(60, 60)).toBe(true);
    expect(presentePorMinutos(59, 60)).toBe(false);
  });

  it("converte HH:mm", () => {
    expect(hhMmToMinutes("09:30")).toBe(570);
  });
});
