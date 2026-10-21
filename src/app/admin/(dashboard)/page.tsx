import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Room } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRoomDialog } from "./create-room-dialog";
import { PublishSwitch } from "./publish-switch";

export default function RoomsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Rooms</h1>
          <p className="text-muted-foreground">
            A room is the area one camera unit covers. Draw zones inside it,
            then publish it to the public map.
          </p>
        </div>
        <CreateRoomDialog />
      </div>
      <Suspense fallback={<RoomsSkeleton />}>
        <RoomsList />
      </Suspense>
    </div>
  );
}

interface RoomRow extends Room {
  zones: { count: number }[];
  camera_units: { id: string; name: string }[];
}

async function RoomsList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, kind, published, zones(count), camera_units(id, name)")
    .order("created_at");

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  const rooms = (data ?? []) as unknown as RoomRow[];

  if (rooms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No rooms yet</CardTitle>
          <CardDescription>
            Create a room for each space a camera unit watches.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rooms.map((room) => {
        const zoneCount = room.zones?.[0]?.count ?? 0;
        return (
          <Card key={room.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl">
                    <Link
                      href={`/admin/rooms/${room.id}`}
                      className="after:absolute after:inset-0 hover:underline"
                    >
                      {room.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {zoneCount === 1 ? "1 zone" : `${zoneCount} zones`}
                    {room.camera_units.length > 0
                      ? ` · ${room.camera_units.map((u) => u.name).join(", ")}`
                      : " · no camera unit"}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {room.kind}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="relative z-10">
                <PublishSwitch roomId={room.id} published={room.published} />
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RoomsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-36" />
      ))}
    </div>
  );
}
