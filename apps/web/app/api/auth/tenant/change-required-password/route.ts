import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHANGE_PASSWORD = `/${API_PREFIX}/auth/tenant/change-required-password`;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  return proxyAuthToNest({
    nestPath: CHANGE_PASSWORD,
    method: "POST",
    body,
    incoming: req,
  });
}
