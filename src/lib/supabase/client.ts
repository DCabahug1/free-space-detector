import { createBrowserClient } from "@supabase/ssr";

// Browser client. Uses the publishable (anon) key, so RLS applies.
// Used by the public map for Realtime and by admin client components.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
