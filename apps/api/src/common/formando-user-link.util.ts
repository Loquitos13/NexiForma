import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@nexiforma/database";
import type { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient | PrismaService;

/** NIF provisório único (8…) até o gestor corrigir — só para convites legados sem NIF. */
export function provisionalFormandoNif(seed: string): string {
  const hex = seed.replace(/-/g, "");
  const num = Number.parseInt(hex.slice(0, 10), 16) % 100_000_000;
  return `8${String(num).padStart(8, "0")}`;
}

export async function upsertFormandoProfileForInvite(
  db: Tx,
  tenantId: string,
  input: {
    email: string;
    displayName: string;
    nif: string;
    telefone?: string;
    userId?: string | null;
    nifProvisorio?: boolean;
  },
): Promise<{ id: string }> {
  const nif = input.nif.trim();
  const email = input.email.trim().toLowerCase();

  const byNif = await db.formandoProfile.findFirst({
    where: { tenantId, nif },
  });
  if (byNif) {
    const linkedEmail = byNif.email?.trim().toLowerCase();
    if (linkedEmail && linkedEmail !== email) {
      throw new ConflictException("Já existe um formando com este NIF (email diferente).");
    }
    const updated = await db.formandoProfile.update({
      where: { id: byNif.id },
      data: {
        nome: input.displayName,
        email,
        telefone: input.telefone ?? byNif.telefone,
        ...(input.userId && !byNif.userId ? { userId: input.userId } : {}),
        ...(input.nifProvisorio ? { metadata: { nifProvisorio: true } } : {}),
      },
    });
    return { id: updated.id };
  }

  const byEmail = await db.formandoProfile.findFirst({
    where: { tenantId, email: { equals: email, mode: "insensitive" } },
  });
  if (byEmail) {
    const updated = await db.formandoProfile.update({
      where: { id: byEmail.id },
      data: {
        nome: input.displayName,
        nif,
        telefone: input.telefone ?? byEmail.telefone,
        ...(input.userId && !byEmail.userId ? { userId: input.userId } : {}),
      },
    });
    return { id: updated.id };
  }

  const created = await db.formandoProfile.create({
    data: {
      tenantId,
      nome: input.displayName,
      nif,
      email,
      telefone: input.telefone ?? null,
      userId: input.userId ?? null,
      ...(input.nifProvisorio ? { metadata: { nifProvisorio: true } } : {}),
    },
  });
  return { id: created.id };
}

export async function linkFormandoProfileToUserByEmail(
  db: Tx,
  tenantId: string,
  userId: string,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const profile = await db.formandoProfile.findFirst({
    where: {
      tenantId,
      userId: null,
      email: { equals: normalized, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (!profile) return null;
  await db.formandoProfile.update({
    where: { id: profile.id },
    data: { userId },
  });
  return profile.id;
}

async function linkOrphanFormandoProfilesToUsers(
  db: PrismaService,
  tenantId: string,
): Promise<void> {
  const orphans = await db.formandoProfile.findMany({
    where: { tenantId, userId: null, email: { not: null } },
    select: { id: true, email: true },
    take: 200,
  });
  for (const profile of orphans) {
    if (!profile.email?.trim()) continue;
    const user = await db.user.findFirst({
      where: {
        tenantId,
        role: "FORMANDO",
        email: { equals: profile.email.trim(), mode: "insensitive" },
        active: true,
        formandoProfile: null,
      },
      select: { id: true },
    });
    if (user) {
      await db.formandoProfile.update({
        where: { id: profile.id },
        data: { userId: user.id },
      });
    }
  }
}

/** Garante ficha para convites/contas FORMANDO — visível na tab Formandos. */
export async function ensureFormandoProfilesForTenant(
  db: PrismaService,
  tenantId: string,
): Promise<void> {
  await linkOrphanFormandoProfilesToUsers(db, tenantId);

  const now = new Date();
  const pendingInvites = await db.tenantInvite.findMany({
    where: {
      tenantId,
      role: "FORMANDO",
      acceptedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      formandoNif: true,
      formandoTelefone: true,
    },
    take: 200,
  });

  for (const inv of pendingInvites) {
    const email = inv.email.trim().toLowerCase();
    const existing = await db.formandoProfile.findFirst({
      where: {
        tenantId,
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          ...(inv.formandoNif ? [{ nif: inv.formandoNif }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) continue;

    const nif = inv.formandoNif?.trim() || provisionalFormandoNif(inv.id);
    await upsertFormandoProfileForInvite(db, tenantId, {
      email,
      displayName: inv.displayName?.trim() || email.split("@")[0] || "Formando",
      nif,
      telefone: inv.formandoTelefone ?? undefined,
      nifProvisorio: !inv.formandoNif?.trim(),
    });
  }

  const usersWithoutProfile = await db.user.findMany({
    where: { tenantId, role: "FORMANDO", active: true, formandoProfile: null },
    select: { id: true, email: true, displayName: true },
    take: 200,
  });

  for (const u of usersWithoutProfile) {
    const invite = await db.tenantInvite.findFirst({
      where: {
        tenantId,
        email: { equals: u.email, mode: "insensitive" },
        role: "FORMANDO",
      },
      orderBy: { createdAt: "desc" },
      select: { formandoNif: true, formandoTelefone: true, displayName: true },
    });

    const nif = invite?.formandoNif?.trim() || provisionalFormandoNif(u.id);
    await upsertFormandoProfileForInvite(db, tenantId, {
      email: u.email,
      displayName: invite?.displayName?.trim() || u.displayName,
      nif,
      telefone: invite?.formandoTelefone ?? undefined,
      userId: u.id,
      nifProvisorio: !invite?.formandoNif?.trim(),
    });
  }
}
