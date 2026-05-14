import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

// Factory rather than module-level singleton so a missing env var fails at
// call-site (clear stack trace) rather than at import-time (breaks the build
// before the values are pasted in).
export function createSupabaseClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local."
    );
  }
  if (!anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Add it to .env.local."
    );
  }

  return createClient<Database>(url, anonKey);
}
