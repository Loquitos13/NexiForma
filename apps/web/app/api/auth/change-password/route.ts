import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANGE_PW_PATH = `/${API_PREFIX}/auth/change-password` as const;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as unknown;
  return proxyAuthToNest({
    nestPath: CHANGE_PW_PATH,
    method: "POST",
    body,
    incoming: req,
  });
}
