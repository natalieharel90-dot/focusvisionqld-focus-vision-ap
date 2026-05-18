"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// Staff may register with a Focus Vision or Queensland Eye Institute
// address. Keep in sync with create_staff_user (DB) and the sign-up page.
const STAFF_EMAIL_DOMAINS = ["@focusvision.com.au", "@qei.org.au"];

// Carried across the redirect to /sign-up/mfa so the enrollment page knows
// what name/role to insert into staff_users after the factor is verified.
const PENDING_STAFF_COOKIE = "fv_pending_staff";

// Self-service sign-up offers the standard clinical roles. role is plain
// text on staff_users now; the wider role list lives in staff_roles.
type StaffRole =
  | "surgeon"
  | "optometrist"
  | "nurse"
  | "reception"
  | "clinic manager";
const STAFF_ROLES: ReadonlyArray<StaffRole> = [
  "surgeon",
  "optometrist",
  "nurse",
  "reception",
  "clinic manager",
];

function backToSignUp(message: string): never {
  redirect(`/sign-up?error=${encodeURIComponent(message)}`);
}

export async function signUpAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as StaffRole;
  const inviteCode = String(formData.get("invite_code") ?? "");

  if (!name) backToSignUp("Name is required.");
  if (!email) backToSignUp("Email is required.");
  if (!password || password.length < 8) {
    backToSignUp("Password must be at least 8 characters.");
  }
  if (!STAFF_EMAIL_DOMAINS.some((d) => email.endsWith(d))) {
    backToSignUp(
      `Email must end with ${STAFF_EMAIL_DOMAINS.join(" or ")}.`
    );
  }
  if (!STAFF_ROLES.includes(role)) {
    backToSignUp("Pick a valid role.");
  }

  const expected = process.env.STAFF_INVITE_CODE;
  if (!expected) {
    backToSignUp("Staff sign-up is not configured. Contact an administrator.");
  }
  if (inviteCode !== expected) {
    backToSignUp("Invalid invite code.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) backToSignUp(error.message);

  // Stash name + role for the MFA-enrollment step to read after the user
  // confirms their TOTP factor. HttpOnly so it never reaches the browser
  // bundle; cleared by the MFA step on success.
  cookies().set(
    PENDING_STAFF_COOKIE,
    JSON.stringify({ name, role }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30,
    }
  );

  // If Supabase requires email confirmation, no session is returned and we
  // need the user to click the email link first. /auth-callback will land
  // them on /sign-up/mfa.
  if (!data.session) {
    redirect(`/sign-up?check_email=${encodeURIComponent(email)}`);
  }

  redirect("/sign-up/mfa");
}
