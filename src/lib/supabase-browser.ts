"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

// Browser client for Client Components. Cookie storage is managed by
// @supabase/ssr; pair it with the matching server client + middleware.
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
