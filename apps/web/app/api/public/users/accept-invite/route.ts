import { proxyV1ToNest } from "@/lib/server/nest-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aceitar convite — rota anónima dedicada (sem inject de sessão BFF). */
export async function POST(req: Request) {
  return proxyV1ToNest(req, ["users", "accept-invite"]);
}
