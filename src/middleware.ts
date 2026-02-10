import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Unified Middleware: Authentication + Feature Flags
 *
 * This middleware provides two layers of protection:
 * 1. Authentication (app-wide): Requires valid session for all routes except public ones
 * 2. Feature flags: Redirects to /v2 if disabled features are accessed
 *
 * Public routes (no auth required):
 * - /auth/* - Authentication pages
 * - /api/auth/* - NextAuth endpoints
 * - /api/health - Health checks (infrastructure monitoring)
 * - /api/branding - Branding config (needed for signin page)
 * - /_next/* - Next.js assets
 * - /favicon.ico - Favicon
 *
 * All other routes require authentication.
 */

// Feature flags - read directly from env (can't import from lib in middleware edge runtime)
// Default to true (enabled) unless explicitly set to "false"
const features = {
  chat: process.env.NEXT_PUBLIC_FEATURE_CHAT_ENABLED !== "false",
  contracts: process.env.NEXT_PUBLIC_FEATURE_CONTRACTS_ENABLED !== "false",
  usage: process.env.NEXT_PUBLIC_FEATURE_USAGE_ENABLED !== "false",
  auditLog: process.env.NEXT_PUBLIC_FEATURE_AUDIT_LOG_ENABLED !== "false",
};

// Routes that require feature flags (checked AFTER auth passes)
const featureFlaggedRoutes: Record<string, keyof typeof features> = {
  "/v2/chat": "chat",
  "/v2/contracts": "contracts",
  "/v2/usage": "usage",
  "/v2/audit-log": "auditLog",
};

// Routes that don't require authentication
const publicRoutes = [
  "/auth/signin",
  "/api/auth",
  "/api/health",
  "/api/branding",
];

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => {
    if (route.endsWith("/*")) {
      const baseRoute = route.slice(0, -2);
      return pathname.startsWith(baseRoute);
    }
    if (route === "/api/auth") {
      return pathname.startsWith("/api/auth/");
    }
    return pathname === route || pathname.startsWith(route + "/");
  });
}

/**
 * Check if a route is a static asset (no auth needed)
 */
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.[a-z0-9]+$/i.test(pathname) // File extensions like .js, .css, .png
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const start = Date.now();

  // Skip middleware for static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // ============================================================================
  // OKTA-INITIATED LOGIN HANDLING
  // ============================================================================
  // Auto-redirect to Okta if accessing sign-in page with iss parameter
  // This handles Okta-initiated login (clicking Okta app tile in Okta dashboard)
  if (pathname === "/auth/signin") {
    const iss = searchParams.get("iss");
    if (iss) {
      let provider = "google";
      try {
        const issUrl = new URL(iss);
        if (issUrl.hostname === "okta.com" || issUrl.hostname.endsWith(".okta.com")) {
          provider = "okta";
        }
      } catch {
        // Invalid URL, default to google
      }
      const callbackUrl = searchParams.get("callbackUrl") || "/v2";

      const url = request.nextUrl.clone();
      url.pathname = `/api/auth/signin/${provider}`;
      url.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(url);
    }
  }

  // ============================================================================
  // AUTHENTICATION CHECK
  // ============================================================================
  // Public routes bypass authentication
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Get JWT token from session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // For API routes: return 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // For page routes: redirect to signin with callback URL
    const signinUrl = request.nextUrl.clone();
    signinUrl.pathname = "/auth/signin";
    signinUrl.searchParams.set("callbackUrl", pathname + request.nextUrl.search);

    return NextResponse.redirect(signinUrl);
  }

  // ============================================================================
  // FEATURE FLAG CHECKS (after auth passes)
  // ============================================================================
  for (const [route, feature] of Object.entries(featureFlaggedRoutes)) {
    if (pathname === route || pathname.startsWith(route + "/")) {
      if (!features[feature]) {
        const url = request.nextUrl.clone();
        url.pathname = "/v2";
        return NextResponse.redirect(url);
      }
    }
  }

  // ============================================================================
  // OBSERVABILITY
  // ============================================================================
  const response = NextResponse.next();
  const duration = Date.now() - start;

  // Add Server-Timing header for observability
  response.headers.set("Server-Timing", `middleware;dur=${duration}`);

  // Log slow requests (>500ms)
  if (duration > 500) {
    console.warn(`[Auth Middleware] ⚠️ Slow request: ${pathname} took ${duration}ms`);
  }

  return response;
}

// Run middleware on all routes except Next.js internals and public files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     *
     * Includes /api/* for authentication and monitoring
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*|_next).*)",
  ],
};
