import { proxyAuthToNest, bffAuthCookiePath } from "@/lib/server/auth-bff";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { API_PREFIX } from "@nexiforma/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGOUT = `/${API_PREFIX}/auth/logout`;
const REFRESH_COOKIE = "nexiforma_refresh";

function appendLogoutCookieClears(res: NextResponse): void {
  const paths = new Set<string>(["/", bffAuthCookiePath(), "/api/auth", `/${API_PREFIX}/auth`]);
  for (const path of paths) {
    res.cookies.set(REFRESH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path,
      maxAge: 0,
    });
  }
}

export async function POST(req: NextRequest) {
  const proxied = await proxyAuthToNest({
    nestPath: LOGOUT,
    method: "POST",
    incoming: req,
  });

  const res = new NextResponse(proxied.body, {
    status: proxied.status,
    headers: proxied.headers,
  });
  appendLogoutCookieClears(res);
  return res;
}
