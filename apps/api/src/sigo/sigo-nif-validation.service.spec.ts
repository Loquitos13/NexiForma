import { SigoNifValidationService } from "./sigo-nif-validation.service";

describe("SigoNifValidationService", () => {
  const svc = new SigoNifValidationService();

  afterEach(() => {
    delete process.env.SIGO_NIF_VALIDATION;
  });

  it("marca required apenas com env", () => {
    expect(svc.isRequired()).toBe(false);
    process.env.SIGO_NIF_VALIDATION = "required";
    expect(svc.isRequired()).toBe(true);
  });

  it("rejeita formato inválido", async () => {
    const r = await svc.validarNifPessoal("123");
    expect(r.codigo).toBe("INVALID_FORMAT");
    expect(r.valido).toBe(false);
  });

  it("stub NOT_IMPLEMENTED para NIF com checksum ok", async () => {
    // 502011378 = checksum válido (empresa; usado só para teste de formato)
    const r = await svc.validarNifPessoal("502011378");
    expect(r.codigo).toBe("NOT_IMPLEMENTED");
    expect(r.disponivel).toBe(false);
    expect(r.valido).toBeNull();
  });
});
