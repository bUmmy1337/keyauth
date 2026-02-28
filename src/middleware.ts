// ─────────────────────────────────────────────────────────
// Next.js Middleware — Auth guard + security headers
// Runs on Edge Runtime for all requests
// ─────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/docs",
  "/api/auth/login",
  "/api/auth/register",
  "/api/validate",
  "/api/heartbeat",
  "/api/telegram",
  // Portal (public-facing) API endpoints
  "/api/portal/info",
  "/api/portal/register",
  "/api/portal/login",
  "/api/portal/logout",
];

const PORTAL_AUTH_PATHS = [
  "/api/portal/me",
  "/api/portal/activate",
  "/api/portal/chat",
];

const API_AUTH_PATHS = [
  "/api/keys",
  "/api/logs",
  "/api/stats",
  "/api/projects",
  "/api/admin",
  "/api/auth/me",
  "/api/auth/logout",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPortalRoute(pathname: string): boolean {
  return pathname.startsWith("/p/");
}

function isPortalAuthApi(pathname: string): boolean {
  return PORTAL_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtectedApi(pathname: string): boolean {
  return API_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Security headers for all responses ─────────────────
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // ─── Skip public routes ─────────────────────────────────
  if (isPublic(pathname)) {
    return response;
  }

  // ─── Portal pages (/p/[slug]) — always accessible ──────
  if (isPortalRoute(pathname)) {
    return response;
  }

  // ─── Portal API auth (uses portal_token) ────────────────
  if (isPortalAuthApi(pathname)) {
    const portalToken =
      request.cookies.get("portal_token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!portalToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", timestamp: Date.now() },
        { status: 401 }
      );
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      await jwtVerify(portalToken, secret, {
        issuer: "self-keyauth",
        audience: "self-keyauth-portal",
      });
      return response;
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token", timestamp: Date.now() },
        { status: 401 }
      );
    }
  }

  // ─── Static assets ──────────────────────────────────────
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return response;
  }

  // ─── Auth verification (admin dashboard) ────────────────
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    if (isProtectedApi(pathname)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", timestamp: Date.now() },
        { status: 401 }
      );
    }
    // Redirect to login for dashboard pages
    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Verify JWT
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(token, secret, {
      issuer: "self-keyauth",
      audience: "self-keyauth-dashboard",
    });
    return response;
  } catch {
    // Invalid token
    if (isProtectedApi(pathname)) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token", timestamp: Date.now() },
        { status: 401 }
      );
    }
    if (pathname.startsWith("/dashboard")) {
      const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
      redirectResponse.cookies.delete("auth_token");
      return redirectResponse;
    }
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
