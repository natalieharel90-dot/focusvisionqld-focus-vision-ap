import { redirect } from "next/navigation";

import { FocusVisionLogo } from "@/components/FocusVisionLogo";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { signOutAction } from "@/app/sign-out/actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // Belt-and-suspenders: middleware already redirected unauthenticated
  // users, but a patient (or any non-staff auth.user) could in theory hold
  // a session. Reject anyone not in staff_users.
  const { data: staff } = await supabase
    .from("staff_users")
    .select("name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!staff) {
    await supabase.auth.signOut();
    redirect("/sign-in?error=Account+is+not+a+staff+member.");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-fv-bg-soft bg-fv-bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <FocusVisionLogo size={36} />
            <span className="text-sm font-semibold text-fv-text-primary">
              Staff dashboard
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-fv-text-secondary">
              {staff.name} · <span className="capitalize">{staff.role}</span>
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-fv-bg-soft px-3 py-1.5 font-medium text-fv-text-primary hover:bg-fv-bg-soft"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div>{children}</div>
    </div>
  );
}
