import { proxyAuthToNest } from "@/lib/server/auth-bff";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StartBody = {
  tenantId?: string;
  targetUserId?: string;
  reason?: string;
  readOnly?: boolean;
};

export async function POST(req: NextRequest) {
  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return Response.json({ message: "Corpo JSON inválido." }, { status: 400 });
  }
  if (!body.tenantId || !body.targetUserId || !body.reason?.trim()) {
    return Response.json(
      { message: "tenantId, targetUserId e reason são obrigatórios." },
      { status: 400 },
    );
  }
  const nestPath = `/${API_PREFIX}/control-plane/tenants/${body.tenantId}/impersonate` as `/${string}`;
  return proxyAuthToNest({
    nestPath,
    method: "POST",
    body: {
      targetUserId: body.targetUserId,
      reason: body.reason.trim(),
      readOnly: body.readOnly ?? true,
    },
    incoming: req,
  });
}
