import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

// Public paths that don't require an authenticated session.
const PUBLIC_PATHS = new Set([
  "/sign-in",
  "/sign-in/mfa",
  "/sign-up",
  "/sign-up/mfa",
  "/sign-out",
  "/auth-callback",
  "/test-supabase",
  "/patient-sign-in",
  "/reset-password",
  // Public so a staff recovery session (which is only aal1) reaches the
  // form instead of being bounced to the MFA step-up.
  "/reset-password/update",
]);

// Every route that belongs to the patient app. Anything protected that is
// NOT in this list is treated as a staff route. Keep this complete — a
// missing entry would bounce patients off a real patient screen.
const PATIENT_PROTECTED_PREFIXES = [
  "/home",
  "/check-in",
  "/medications",
  "/messages",
  "/preferences",
  "/documents",
  "/contact",
  "/feedback",
  "/pre-op",
  "/videos",
  "/appointments",
  "/welcome",
  "/verify-phone",
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

  // ── Staff routes ────────────────────────────────────────────────────
  // Everything protected that isn't a patient route is staff territory.
  // The signed-in user must be a staff member AND have completed MFA
  // (aal2); /audit and /analytics carry extra access-tier gates.
  if (!isPatientProtectedPath(pathname)) {
    const { data: staff } = await supabase
      .from("staff_users")
      .select("access_tier, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!staff) {
      // A patient (or any non-staff account) reached a staff route.
      const url = request.nextUrl.clone();
      url.pathname = "/home";
      return NextResponse.redirect(url);
    }

    // Staff sign-in requires TOTP; a session that has a second factor
    // enrolled but hasn't completed it must finish MFA first.
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel !== "aal2" && aal.nextLevel === "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in/mfa";
      return NextResponse.redirect(url);
    }

    const onAudit = pathname === "/audit" || pathname.startsWith("/audit/");
    const onAnalytics =
      pathname === "/analytics" || pathname.startsWith("/analytics/");
    if (onAudit && staff.access_tier !== 1) {
      return new NextResponse(
        "403 Forbidden — the audit log requires tier-1 (Owner / Admin / Clinical Lead) access.",
        { status: 403, headers: { "content-type": "text/plain" } }
      );
    }
    if (
      onAnalytics &&
      !(staff.access_tier === 1 || staff.role === "surgeon")
    ) {
      return new NextResponse(
        "403 Forbidden — analytics is restricted to Owner / Admin / Clinical Lead and Surgeons.",
        { status: 403, headers: { "content-type": "text/plain" } }
      );
    }
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
