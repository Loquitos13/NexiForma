import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { pick?: string; tenantSlug?: string };
  try {
    body = (await req.json()) as { pick?: string; tenantSlug?: string };
  } catch {
    return Response.json({ message: "Corpo JSON inválido." }, { status: 400 });
  }
  if (!body.pick?.trim() || !body.tenantSlug?.trim()) {
    return Response.json({ message: "Seleção de entidade incompleta." }, { status: 400 });
  }
  return proxyAuthToNest({
    nestPath: `/${API_PREFIX}/auth/oauth/pick-tenant` as `/${string}`,
    method: "POST",
    body: { pick: body.pick.trim(), tenantSlug: body.tenantSlug.trim() },
    incoming: req,
  });
}
