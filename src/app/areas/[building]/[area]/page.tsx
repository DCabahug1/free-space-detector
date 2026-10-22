import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";

type Params = Promise<{ building: string; area: string }>;

// Deprecated. The public map carries everything the area page showed, so an
// old link lands on the map with its building searched for. The lookup runs
// inside Suspense so the route can still be prerendered as a shell.
export default function AreaRedirect({ params }: { params: Params }) {
  return (
    <Suspense fallback={null}>
      <Redirector params={params} />
    </Suspense>
  );
}

async function Redirector({ params }: { params: Params }) {
  const { building } = await params;
  const { data } = await createPublicClient().from("buildings").select("name").eq("slug", building).maybeSingle();
  return redirect(data?.name ? `/?q=${encodeURIComponent(data.name)}` : "/");
}
