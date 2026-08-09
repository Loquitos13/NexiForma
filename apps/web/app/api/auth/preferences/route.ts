import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFERENCES = `/${API_PREFIX}/auth/preferences`;

export async function PATCH(req: NextRequest) {
  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  return proxyAuthToNest({
    nestPath: PREFERENCES,
    method: "PATCH",
    body,
    incoming: req,
  });
}
