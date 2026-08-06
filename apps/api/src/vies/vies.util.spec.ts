import {
  buildViesResult,
  cleanViesText,
  evaluateNifConfirmation,
  formatNifPtMorada,
  isNifColetivoPt,
  isPlaceholderViesField,
  mapNifPtResponse,
  nifPtUrl,
  parseVatInput,
} from "./vies.util";

describe("vies.util (NIF.PT + Portugal NIF)", () => {
  describe("parseVatInput", () => {
    it("aceita NIF PT de 9 dígitos", () => {
      expect(parseVatInput("502011378")).toEqual({ countryCode: "PT", vatNumber: "502011378" });
    });

    it("aceita prefixo PT e espaços", () => {
      expect(parseVatInput("PT 502 011 378")).toEqual({ countryCode: "PT", vatNumber: "502011378" });
    });

    it("rejeita país não-PT", () => {
      expect(parseVatInput("6388047V", "IE")).toBeNull();
    });

    it("rejeita tamanho incorrecto", () => {
      expect(parseVatInput("123")).toBeNull();
    });
  });

  describe("cleanViesText", () => {
    it("trata placeholders", () => {
      expect(isPlaceholderViesField("---")).toBe(true);
      expect(cleanViesText("---")).toBeNull();
      expect(cleanViesText("Rua X\n Braga")).toBe("Rua X\nBraga");
    });
  });

  describe("mapNifPtResponse", () => {
    it("mapeia resposta válida", () => {
      const r = mapNifPtResponse("509442013", true, {
        result: "success",
        nif_validation: true,
        is_nif: true,
        records: {
          "509442013": {
            nif: 509442013,
            title: "Nexperience Lda",
            address: "Rua da Lionesa",
            pc4: "4465",
            pc3: "671",
            city: "Leça do Balio",
            status: "active",
          },
        },
      });
      expect(r.validoRegisto).toBe(true);
      expect(r.disponivel).toBe(true);
      expect(r.fonte).toBe("nif_pt");
      expect(r.nome).toBe("Nexperience Lda");
      expect(r.morada).toContain("Leça do Balio");
    });

    it("marca indisponível em erros de API", () => {
      const r = mapNifPtResponse("509442013", true, {
        result: "error",
        message: "rate limit",
      });
      expect(r.disponivel).toBe(false);
      expect(r.validoRegisto).toBeNull();
    });

    it("mapeia inválido no NIF.PT", () => {
      const r = mapNifPtResponse("100000009", true, {
        result: "success",
        nif_validation: false,
        is_nif: false,
        records: {},
      });
      expect(r.disponivel).toBe(true);
      expect(r.validoRegisto).toBe(false);
      expect(r.nome).toBeNull();
    });
  });

  describe("evaluateNifConfirmation", () => {
    it("aceita pessoa com formato válido", () => {
      const r = buildViesResult({
        countryCode: "PT",
        vatNumber: "123456789",
        formatoValido: true,
        disponivel: true,
        validoRegisto: true,
        fonte: "portugal_nif",
      });
      expect(evaluateNifConfirmation(r, "pessoa")).toEqual({ ok: true });
    });

    it("exige NIF.PT para empresa", () => {
      expect(isNifColetivoPt("502011378")).toBe(true);
      const invalid = buildViesResult({
        countryCode: "PT",
        vatNumber: "502011378",
        formatoValido: true,
        disponivel: true,
        validoRegisto: false,
        fonte: "nif_pt",
      });
      expect(evaluateNifConfirmation(invalid, "empresa").ok).toBe(false);
      const valid = buildViesResult({
        countryCode: "PT",
        vatNumber: "502011378",
        formatoValido: true,
        disponivel: true,
        validoRegisto: true,
        nome: "X",
        fonte: "nif_pt",
      });
      expect(evaluateNifConfirmation(valid, "empresa")).toEqual({ ok: true });
    });
  });

  describe("nifPtUrl / formatNifPtMorada", () => {
    it("monta URL NIF.PT", () => {
      expect(nifPtUrl("509442013", "mykey", "https://www.nif.pt/")).toBe(
        "https://www.nif.pt/?json=1&q=509442013&key=mykey",
      );
    });

    it("formata morada", () => {
      expect(
        formatNifPtMorada({
          address: "Rua A",
          pc4: "1000",
          pc3: "001",
          city: "Lisboa",
        }),
      ).toBe("Rua A, 1000-001, Lisboa");
    });
  });
});
