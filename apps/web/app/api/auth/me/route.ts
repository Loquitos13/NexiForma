import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ME = `/${API_PREFIX}/auth/me`;

export async function GET(req: NextRequest) {
  return proxyAuthToNest({
    nestPath: ME,
    method: "GET",
    incoming: req,
  });
}
