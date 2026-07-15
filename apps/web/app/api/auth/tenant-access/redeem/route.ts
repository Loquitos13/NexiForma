import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { key?: string };
  try {
    body = (await req.json()) as { key?: string };
  } catch {
    return Response.json({ message: "Corpo JSON inválido." }, { status: 400 });
  }
  if (!body.key?.trim()) {
    return Response.json({ message: "Chave em falta." }, { status: 400 });
  }
  const nestPath = `/${API_PREFIX}/control-plane/tenant-access/redeem` as `/${string}`;
  return proxyAuthToNest({
    nestPath,
    method: "POST",
    body: { key: body.key.trim() },
    incoming: req,
  });
}
