import type { PrismaClient } from "@nexiforma/database";
import * as argon2 from "argon2";
import { normalizeAuthEmail } from "./tenant-auth-resolve.util";

type PrismaLike = Pick<PrismaClient, "user">;

/** Devolve o hash que corresponde à password, ou null. */
export async function matchPasswordHash(
  hashes: Array<string | null | undefined>,
  password: string,
): Promise<string | null> {
  const unique = [...new Set(hashes.filter((h): h is string => Boolean(h)))];
  for (const hash of unique) {
    try {
      if (await argon2.verify(hash, password)) return hash;
    } catch {
      // ignora hash com formato inválido
    }
  }
  return null;
}

/**
 * Propaga o mesmo password hash a todas as contas tenant com o mesmo email.
 * Assim a palavra-passe é única por conta (email), não por entidade.
 */
export async function syncPasswordHashByEmail(
  prisma: PrismaLike,
  emailRaw: string,
  passwordHash: string,
  opts?: { mustChangePassword?: boolean },
): Promise<number> {
  const email = normalizeAuthEmail(emailRaw);
  const result = await prisma.user.updateMany({
    where: { email },
    data: {
      passwordHash,
      ...(opts?.mustChangePassword !== undefined
        ? { mustChangePassword: opts.mustChangePassword }
        : {}),
    },
  });
  return result.count;
}
