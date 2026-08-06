import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { exchange?: string };
  try {
    body = (await req.json()) as { exchange?: string };
  } catch {
    return Response.json({ message: "Corpo JSON inválido." }, { status: 400 });
  }
  if (!body.exchange?.trim()) {
    return Response.json({ message: "Exchange OAuth em falta." }, { status: 400 });
  }
  return proxyAuthToNest({
    nestPath: `/${API_PREFIX}/auth/oauth/exchange` as `/${string}`,
    method: "POST",
    body: { exchange: body.exchange.trim() },
    incoming: req,
  });
}
