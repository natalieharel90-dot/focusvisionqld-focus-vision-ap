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
  "/contact",
  "/feedback",
  "/pre-op",
  "/videos",
  "/appointments",
  "/welcome",
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
  // The reminder cron endpoint authenticates itself with CRON_SECRET and
  // is called by an external scheduler that has no session.
  if (pathname.startsWith("/api/cron")) return true;
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

  // When a staff user opens a thread (inbox or staff mobile app), mark
  // its inbound patient messages read BEFORE the layout's sidebar badge
  // query runs in parallel with the page render. The RPC is idempotent
  // and only marks the caller's visible messages.
  if (user) {
    let threadIdToMark: string | null = null;
    if (pathname === "/inbox") {
      threadIdToMark = request.nextUrl.searchParams.get("thread");
    } else if (
      pathname.startsWith("/staff-app/messages/") &&
      pathname !== "/staff-app/messages"
    ) {
      threadIdToMark = pathname.split("/")[3] ?? null;
    }
    if (threadIdToMark) {
      await supabase.rpc("mark_thread_read", {
        p_thread_id: threadIdToMark,
      });
    }
  }

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
    url.search = "";
    if (isPatientProtectedPath(pathname)) {
      url.pathname = "/patient-sign-in";
    } else {
      url.pathname = "/sign-in";
      // Remember where they were headed so sign-in returns them there.
      url.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(url);
  }

  // First-sign-in gate: a patient still on the clinic-issued temporary
  // password must replace it before they can use anything else. The
  // forced flow lives at /preferences/account/password?force=1; let
  // them stay on that page (and on the sign-out route).
  if (isPatientProtectedPath(pathname)) {
    const onPasswordPage =
      pathname === "/preferences/account/password" ||
      pathname.startsWith("/preferences/account/password/");
    if (!onPasswordPage) {
      const { data: patient } = await supabase
        .from("patients")
        .select("password_set")
        .eq("id", user.id)
        .maybeSingle();
      if (patient && patient.password_set === false) {
        const url = request.nextUrl.clone();
        url.pathname = "/preferences/account/password";
        url.search = "?force=1";
        return NextResponse.redirect(url);
      }
    }
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
      // A non-staff user reached a staff route. If they're a patient,
      // send them home. If they're NEITHER staff nor patient (orphaned
      // session — e.g. their patient row was deleted), sign them out
      // here to break the /home ↔ / redirect loop, otherwise /home
      // would also reject them and bounce them back to / via the
      // patient layout.
      const { data: patientRow } = await supabase
        .from("patients")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!patientRow) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/sign-in";
        url.search =
          "?error=Account+not+recognised+—+please+sign+in+again.";
        return NextResponse.redirect(url);
      }
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
    // are matched but allowed through by isPublicPath above. sw.js and
    // manifest.json must be excluded — a service worker cannot load
    // through the redirect the middleware would otherwise apply.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
