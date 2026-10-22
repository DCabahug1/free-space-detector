import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

// Deprecated. The public map carries everything the area page showed, so an
// old link lands on the map with its building searched for.
export default async function AreaRedirect({ params }: { params: Promise<{ building: string; area: string }> }) {
  const { building } = await params;
  const { data } = await createPublicClient().from("buildings").select("name").eq("slug", building).maybeSingle();
  redirect(data?.name ? `/?q=${encodeURIComponent(data.name)}` : "/");
}
