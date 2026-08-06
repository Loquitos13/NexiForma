import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";

export type InteraccaoAutorFields = {
  criadoPorAutorId: string;
  criadoPorDisplayName: string;
  criadoPorEmail: string;
  criadoPorUserId: string;
};

export async function interaccaoAutorFromUserId(
  prisma: Pick<PrismaService, "user">,
  userId: string,
): Promise<InteraccaoAutorFields> {
  const u = await prisma.user.findFirst({
    where: { id: userId },
    select: { id: true, displayName: true, email: true },
  });
  if (!u) {
    throw new BadRequestException("Utilizador não encontrado.");
  }
  return {
    criadoPorAutorId: u.id,
    criadoPorDisplayName: u.displayName,
    criadoPorEmail: u.email,
    criadoPorUserId: u.id,
  };
}
