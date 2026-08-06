import {
  assertSafeOutboundUrl,
  signLeadWebhookPayload,
  signLeadWebhookPayloadV1,
  verifyLeadWebhookSignature,
} from "@nexiforma/shared";

describe("lead webhook HMAC", () => {
  const secret = "test-secret-hex";
  const input = {
    empresaNome: "Acme Lda",
    contactoNome: "João",
    email: "joao@acme.pt",
    telefone: "+351912345678",
    nif: "509999990",
    origem: "WEBSITE",
    valorEstimadoCentavos: 10000,
    notas: "Interessado em CRM",
    customFields: { sector: "IT" },
  };

  it("v2 assina todos os campos", () => {
    const sig = signLeadWebhookPayload(secret, input);
    expect(verifyLeadWebhookSignature(secret, `sha256=${sig}`, input)).toBe(true);
  });

  it("rejeita alteração de customFields sem novo HMAC", () => {
    const sig = signLeadWebhookPayload(secret, input);
    const tampered = { ...input, customFields: { sector: "Finance" } };
    expect(verifyLeadWebhookSignature(secret, `sha256=${sig}`, tampered)).toBe(false);
  });

  it("mantém compatibilidade v1 legado", () => {
    const v1 = signLeadWebhookPayloadV1(secret, input.empresaNome, input.email, input.telefone);
    expect(verifyLeadWebhookSignature(secret, v1, input)).toBe(true);
  });
});

describe("SSRF URL guard", () => {
  it("bloqueia localhost", () => {
    expect(() => assertSafeOutboundUrl("http://127.0.0.1/hook")).toThrow();
  });

  it("permite https público", () => {
    const url = assertSafeOutboundUrl("https://hooks.example.com/leads", {
      allowHttp: false,
      requireHttps: true,
    });
    expect(url.hostname).toBe("hooks.example.com");
  });
});
