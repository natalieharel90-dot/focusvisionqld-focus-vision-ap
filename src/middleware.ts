import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

// Public paths that don't require an authenticated staff session.
// Everything else under "/" is treated as protected.
const PUBLIC_PATHS = new Set([
  "/sign-in",
  "/sign-in/mfa",
  "/sign-up",
  "/sign-up/mfa",
  "/sign-out",
  "/auth-callback",
  "/test-supabase",
  "/patient-sign-in",
]);

// Paths that live in the (patient) route group. Unauthenticated access
// should bounce to /patient-sign-in, not the staff /sign-in. Keep in sync
// as the patient app grows.
const PATIENT_PROTECTED_PREFIXES = [
  "/home",
  "/check-in",
  "/medications",
  "/messages",
];

function isPatientProtectedPath(pathname: string): boolean {
  return PATIENT_PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Allow Next internals, public assets, favicons. Matcher below already
  // excludes these, but defensive in case the matcher widens later.
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/health")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  // Build a response we may mutate (set-cookie) and return.
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session if expired and writes the refreshed cookie above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    // If already signed-in staff, send them to the dashboard rather than
    // letting them re-enter auth flows.
    if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    if (user && pathname === "/patient-sign-in") {
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = isPatientProtectedPath(pathname)
      ? "/patient-sign-in"
      : "/sign-in";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static files and Next internals. Auth pages
    // are matched but allowed through by isPublicPath above.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
