import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  canAccessPlatformArea,
  canAccessPortalArea,
  type MiddlewareJwtSlice,
} from "@/lib/middleware-auth";

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
  return NextResponse.redirect(login);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { hasRefresh, payload } = getSession(request);

  if (!hasRefresh) {
    return redirectToLogin(request, pathname);
  }

  // O access JWT é guardado em sessionStorage no browser; no edge só chega a refresh cookie.
  // Sem payload decodificável aqui, deixa passar - RBAC é aplicado no layout cliente.
  if (!payload?.role) {
    return NextResponse.next();
  }

  const role = payload.role;
  const kind = payload.kind ?? null;
  const impersonating = payload.impersonating === true;

  if (pathname.startsWith("/plataforma")) {
    if (!canAccessPlatformArea(role, kind)) {
      return NextResponse.redirect(new URL("/acesso-negado", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal")) {
    if (!canAccessPortalArea(role, kind, impersonating)) {
      if (canAccessPlatformArea(role, kind)) {
        return NextResponse.redirect(new URL("/plataforma", request.url));
      }
      return NextResponse.redirect(new URL("/acesso-negado", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal", "/portal/:path*", "/plataforma", "/plataforma/:path*"],
};
