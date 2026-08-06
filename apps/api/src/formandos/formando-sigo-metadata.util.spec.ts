import { formandoSigoPronto, mergeFormandoMetadataSigo } from "./formando-sigo-metadata.util";

describe("formandoSigoPronto", () => {
  it("false quando metadados vazios", () => {
    expect(formandoSigoPronto(null)).toBe(false);
    expect(formandoSigoPronto({})).toBe(false);
  });

  it("true com todos os campos SIGO válidos", () => {
    expect(
      formandoSigoPronto({
        sigo: {
          tipoDocIdentificacao: "CC",
          numDocIdentificacao: "12345678",
          dataNascimento: "1990-05-01",
          nacionalidade: "PT",
          habilitacaoLiteraria: "3",
        },
      }),
    ).toBe(true);
  });

  it("false se falta data nascimento ISO", () => {
    expect(
      formandoSigoPronto({
        sigo: {
          tipoDocIdentificacao: "CC",
          numDocIdentificacao: "12345678",
          dataNascimento: "01/05/1990",
          nacionalidade: "PT",
          habilitacaoLiteraria: "3",
        },
      }),
    ).toBe(false);
  });
});

describe("mergeFormandoMetadataSigo", () => {
  it("faz merge de patch SIGO", () => {
    const out = mergeFormandoMetadataSigo(
      { sigo: { tipoDocIdentificacao: "CC", nacionalidade: "PT" } },
      { numDocIdentificacao: "999", dataNascimento: "2000-01-01", habilitacaoLiteraria: "2" },
    );
    expect(out?.sigo).toMatchObject({
      tipoDocIdentificacao: "CC",
      nacionalidade: "PT",
      numDocIdentificacao: "999",
      dataNascimento: "2000-01-01",
      habilitacaoLiteraria: "2",
    });
  });
});
