import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_PATH = `/${API_PREFIX}/auth/profile` as const;

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  return proxyAuthToNest({
    nestPath: PROFILE_PATH,
    method: "PATCH",
    body,
    incoming: req,
  });
}
