import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const END_PATH = `/${API_PREFIX}/auth/impersonation/end` as const;

export async function POST(req: NextRequest) {
  return proxyAuthToNest({
    nestPath: END_PATH,
    method: "POST",
    incoming: req,
  });
}
