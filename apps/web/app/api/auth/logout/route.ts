import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGOUT = `/${API_PREFIX}/auth/logout`;

export async function POST(req: NextRequest) {
  return proxyAuthToNest({
    nestPath: LOGOUT,
    method: "POST",
    incoming: req,
  });
}
