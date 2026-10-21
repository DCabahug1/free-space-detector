import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Room } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PairForm } from "./pair-form";
import { CameraUnitsTable } from "./camera-units-table";
import type { CameraUnitRow } from "./types";

interface CameraUnitsPageProps {
  // The QR code on a camera unit's monitor links here with ?code=123456.
  searchParams: Promise<{ code?: string }>;
}

export default function CameraUnitsPage({ searchParams }: CameraUnitsPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Camera units</h1>
        <p className="text-muted-foreground">
          Each camera unit shows a 6-digit pair code on its monitor until it is
          claimed. Enter the code here and pick the room it watches.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64" />}>
        <CameraUnitsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CameraUnitsContent({ searchParams }: CameraUnitsPageProps) {
  const { code } = await searchParams;
  const initialCode = code && /^\d{6}$/.test(code) ? code : "";
  const supabase = await createClient();
  const [{ data: units, error }, { data: rooms }] = await Promise.all([
    supabase
      .from("camera_units")
      .select("id, name, pair_code, room_id, last_seen, rooms(id, name)")
      .order("created_at"),
    supabase.from("rooms").select("id, name").order("name"),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const roomOptions = (rooms ?? []) as Pick<Room, "id" | "name">[];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <CameraUnitsTable
        units={(units ?? []) as unknown as CameraUnitRow[]}
        rooms={roomOptions}
      />
      <PairForm rooms={roomOptions} initialCode={initialCode} />
    </div>
  );
}
