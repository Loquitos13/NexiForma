import { BadRequestException, ConflictException } from "@nestjs/common";
import { ControlPlaneService } from "./control-plane.service";

describe("ControlPlaneService.createTenantUser", () => {
  it("creates an active direct tenant user without an invite flow", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1", slug: "demo", legalName: "Demo Tenant" }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "user-1", email: "ana@demo.pt", role: "FORMADOR" }),
      },
      formadorProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "profile-1" }),
      },
      formandoProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "profile-2" }),
      },
      tenantInvite: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (cb) => cb({
        tenant: { findUnique: jest.fn() },
        user: { create: jest.fn(), findFirst: jest.fn() },
        formadorProfile: { findFirst: jest.fn(), create: jest.fn() },
        formandoProfile: { findFirst: jest.fn(), create: jest.fn() },
      })),
    };

    const service = new ControlPlaneService(
      prisma as any,
      { log: jest.fn() } as any,
      { get: jest.fn(), getOrThrow: jest.fn() } as any,
      { notificarSuperadminsTenantLifecycle: jest.fn(), enviarCredenciaisTemporariasGestor: jest.fn() } as any,
      { clear: jest.fn() } as any,
      { issueForUser: jest.fn() } as any,
      { writeFile: jest.fn(), getPublicUrl: jest.fn() } as any,
    );

    const result = await service.createTenantUser(
      { sub: "actor-1", email: "ops@nexiforma.pt" } as any,
      "tenant-1",
      {
        email: "ana@demo.pt",
        displayName: "Ana Silva",
        role: "FORMADOR",
        temporaryPassword: "TempPass123!",
        notifyEmail: false,
        nif: "123456789",
      },
      "127.0.0.1",
    );

    expect(result.ok).toBe(true);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          email: "ana@demo.pt",
          role: "FORMADOR",
          active: true,
          mustChangePassword: true,
        }),
      }),
    );
  });

  it("rejects direct creation when the user already exists in the tenant", async () => {
    const prisma = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: "tenant-1", slug: "demo", legalName: "Demo Tenant" }) },
      user: { findFirst: jest.fn().mockResolvedValue({ id: "user-2", active: true }) },
      formadorProfile: { findFirst: jest.fn() },
      formandoProfile: { findFirst: jest.fn() },
      tenantInvite: { deleteMany: jest.fn() },
    };

    const service = new ControlPlaneService(
      prisma as any,
      { log: jest.fn() } as any,
      { get: jest.fn(), getOrThrow: jest.fn() } as any,
      { notificarSuperadminsTenantLifecycle: jest.fn(), enviarCredenciaisTemporariasGestor: jest.fn() } as any,
      { clear: jest.fn() } as any,
      { issueForUser: jest.fn() } as any,
      { writeFile: jest.fn(), getPublicUrl: jest.fn() } as any,
    );

    await expect(
      service.createTenantUser(
        { sub: "actor-1", email: "ops@nexiforma.pt" } as any,
        "tenant-1",
        { email: "ana@demo.pt", displayName: "Ana Silva", role: "FORMADOR", temporaryPassword: "TempPass123!", notifyEmail: false, nif: "123456789" },
        "127.0.0.1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
