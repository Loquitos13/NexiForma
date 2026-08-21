import { NotFoundException } from "@nestjs/common";
import { BillingService } from "./billing.service";

describe("BillingService", () => {
  const prisma = {
    subscriptionPlan: { findMany: jest.fn(), findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const mail = { sendMail: jest.fn() };

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(prisma as never, config as never, mail as never);
  });

  it("listPlans exclui plano modular e ordena por preço", async () => {
    prisma.subscriptionPlan.findMany.mockResolvedValue([
      { code: "starter", priceCentsMonthly: 1000 },
      { code: "enterprise", priceCentsMonthly: 5000 },
    ]);
    const plans = await service.listPlans();
    expect(prisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
      where: { active: true, code: { not: "modular" } },
      orderBy: { priceCentsMonthly: "asc" },
    });
    expect(plans).toHaveLength(2);
  });

  it("createCheckout rejeita plano inactivo", async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue({ active: false });
    await expect(
      service.createCheckout(
        { kind: "tenant", tenantId: "t1", sub: "u1", roles: [] } as never,
        "starter",
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
