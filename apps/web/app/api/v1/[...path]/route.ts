import { proxyV1ToNest } from "@/lib/server/nest-proxy";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Análise IA / PDF pode demorar vários minutos (Ollama local). */
export const maxDuration = 600;

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function forward(req: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyV1ToNest(req, path ?? []);
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
