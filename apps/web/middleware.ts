import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  canAccessPlatformArea,
  canAccessPortalArea,
  type MiddlewareJwtSlice,
} from "@/lib/middleware-auth";
import {
  applyTransportHeadersToHeaders,
  shouldEnforceHttps,
} from "@/lib/server/transport-security";
import { checkWebDdosRateLimit } from "@/lib/server/ddos-rate-limit";

const REFRESH_COOKIE = "nexiforma_refresh";

function decodeJwtPayload(token: string | undefined): MiddlewareJwtSlice | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as MiddlewareJwtSlice;
  } catch {
    return null;
  }
}

function getSession(request: NextRequest): { hasRefresh: boolean; payload: MiddlewareJwtSlice | null } {
  const hasRefresh = request.cookies.has(REFRESH_COOKIE);
  const access =
    request.cookies.get("nexiforma_access")?.value ?? request.cookies.get("auth-token")?.value;
  return { hasRefresh, payload: decodeJwtPayload(access) };
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return withTransportHeaders(NextResponse.redirect(login));
}

/** Redireciona HTTP→HTTPS em produção (atrás de ALB/nginx com x-forwarded-proto). */
function enforceHttps(request: NextRequest): NextResponse | null {
  if (!shouldEnforceHttps()) return null;

  const forwarded = request.headers.get("x-forwarded-proto");
  const proto = forwarded ?? request.nextUrl.protocol.replace(":", "");
  if (proto === "https") return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  return withTransportHeaders(NextResponse.redirect(url, 308));
}

function withTransportHeaders(response: NextResponse): NextResponse {
  applyTransportHeadersToHeaders(response.headers);
  return response;
}

function isProtectedAppPath(pathname: string): boolean {
  return pathname.startsWith("/portal") || pathname.startsWith("/plataforma");
}

export function middleware(request: NextRequest) {
  const ddos = checkWebDdosRateLimit(request);
  if (!ddos.allowed) {
    const res = NextResponse.json(
      { message: "Demasiados pedidos. Tente novamente dentro de momentos.", statusCode: 429 },
      { status: 429 },
    );
    res.headers.set("Retry-After", String(ddos.retryAfterSec));
    return withTransportHeaders(res);
  }

  const httpsRedirect = enforceHttps(request);
  if (httpsRedirect) return httpsRedirect;

  const { pathname } = request.nextUrl;

  if (!isProtectedAppPath(pathname)) {
    return withTransportHeaders(NextResponse.next());
  }

  const { hasRefresh, payload } = getSession(request);

  if (!hasRefresh) {
    return redirectToLogin(request, pathname);
  }

  if (!payload?.role) {
    return withTransportHeaders(NextResponse.next());
  }

  const role = payload.role;
  const kind = payload.kind ?? null;
  const impersonating = payload.impersonating === true;

  if (pathname.startsWith("/plataforma")) {
    if (!canAccessPlatformArea(role, kind)) {
      return withTransportHeaders(NextResponse.redirect(new URL("/acesso-negado", request.url)));
    }
    return withTransportHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/portal")) {
    if (!canAccessPortalArea(role, kind, impersonating)) {
      if (canAccessPlatformArea(role, kind)) {
        return withTransportHeaders(NextResponse.redirect(new URL("/plataforma", request.url)));
      }
      return withTransportHeaders(NextResponse.redirect(new URL("/acesso-negado", request.url)));
    }
    return withTransportHeaders(NextResponse.next());
  }

  return withTransportHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
