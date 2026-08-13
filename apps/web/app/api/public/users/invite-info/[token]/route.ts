import { proxyV1ToNest } from "@/lib/server/nest-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ token?: string }> };

/** Pré-visualização de convite — rota anónima dedicada. */
export async function GET(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  if (!token?.trim()) {
    return new Response(JSON.stringify({ message: "Token em falta." }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return proxyV1ToNest(req, ["users", "invite-info", token]);
}
