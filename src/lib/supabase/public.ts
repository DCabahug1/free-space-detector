import { createClient } from "@supabase/supabase-js";

// Anonymous server-side client for the public map. No cookies, no session.
// RLS limits it to published rooms, their zones, and zone_counts.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
