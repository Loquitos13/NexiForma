import { ConfigService } from "@nestjs/config";
import { HttpException } from "@nestjs/common";
import { LoginAttemptLimiterService } from "./login-attempt-limiter.service";

describe("LoginAttemptLimiterService", () => {
  const config = { get: () => undefined } as ConfigService;
  const service = new LoginAttemptLimiterService(config);

  beforeEach(() => {
    void service.clear("tenant", "demo:u@x.pt");
    void service.clear("platform", "admin@x.pt");
  });

  it("bloqueia após o máximo de falhas", async () => {
    const id = "demo:u@x.pt";
    for (let i = 0; i < 4; i += 1) {
      await service.recordFailure("tenant", id);
      await expect(service.assertNotLocked("tenant", id)).resolves.toBeUndefined();
    }
    await service.recordFailure("tenant", id);
    await expect(service.assertNotLocked("tenant", id)).rejects.toThrow(HttpException);
  });

  it("limpa contador após login bem-sucedido", async () => {
    const id = "demo:u@x.pt";
    await service.recordFailure("tenant", id);
    await service.recordFailure("tenant", id);
    await service.clear("tenant", id);
    await expect(service.assertNotLocked("tenant", id)).resolves.toBeUndefined();
  });
});
