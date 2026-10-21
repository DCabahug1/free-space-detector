"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setRoomPublished } from "@/app/admin/actions";
import type { PublicRoom, Zone, ZoneCount } from "@/lib/types";
import { roomPath } from "@/lib/types";
import { durationText, isOffline } from "@/lib/occupancy";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useLiveFrame, type LiveFrame } from "@/hooks/use-live-frame";
import { StepRail, type Step } from "@/components/admin/step-rail";
import { RoomView } from "@/components/public-map/room-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PairCard } from "../../device-cards";
import { BackLink } from "@/components/back-link";
import { RoomHeader } from "./room-header";
import { ZoneEditor } from "./zone-editor";

interface SetupPageProps {
  room: PublicRoom;
  initialCounts: ZoneCount[];
  liveFrame: LiveFrame | null;
}

// The projector screen. Step rail on the left, the current step's content
// on the right. Zones live in local state so saves and deletes show at
// once; the server's copy replaces it after each refresh.
export function SetupPage({ room, initialCounts, liveFrame }: SetupPageProps) {
  const [zoneOverride, setZoneOverride] = useState<{ base: Zone[]; zones: Zone[] } | null>(null);
  // The override is dropped as soon as the server sends a different list.
  const zones = zoneOverride && zoneOverride.base === room.zones ? zoneOverride.zones : room.zones;
  const liveRoom: PublicRoom = { ...room, zones };
  const live = useLiveSnapshot([liveRoom], initialCounts);

  const unit = [...room.units].sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""))[0];
  const unitOnline = unit ? !isOffline(unit.last_seen, live.now) : false;

  const [step, setStep] = useState<number>(() => (!unit ? 2 : zones.length === 0 ? 3 : room.published ? 4 : 3));

  const steps: Step[] = [
    { n: 1, title: "Building and area", status: "Done" },
    {
      n: 2,
      title: "Pair the camera unit",
      status: !unit ? (step === 2 ? "In progress" : "Waiting") : unitOnline ? "Done" : "Needs attention",
    },
    {
      n: 3,
      title: "Draw zones",
      status: zones.length === 0 ? (step === 3 ? "In progress" : "Waiting") : "Done",
    },
    {
      n: 4,
      title: "Preview and publish",
      status: room.published ? "Done" : zones.length > 0 ? "Ready" : "Waiting",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <BackLink href="/admin" label="Back to areas" />
        <RoomHeader room={room} zoneCount={zones.length} now={live.now} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
        <StepRail steps={steps} current={step} onSelect={setStep} />
        <div className="min-w-0">
          {step === 1 ? (
            <BuildingStep room={room} onNext={() => setStep(2)} />
          ) : step === 2 ? (
            <PairStep room={room} unitOnline={unitOnline} liveFrame={liveFrame} now={live.now} onNext={() => setStep(3)} />
          ) : step === 3 ? (
            <ZoneEditor
              roomId={room.id}
              zones={zones}
              onZonesChange={(next) => setZoneOverride({ base: room.zones, zones: next })}
              counts={live.countNumbers}
              liveFrame={liveFrame}
              now={live.now}
            />
          ) : (
            <PreviewStep room={liveRoom} initialCounts={initialCounts} unitOnline={unitOnline} />
          )}
        </div>
      </div>
    </div>
  );
}

function BuildingStep({ room, onNext }: { room: PublicRoom; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Building</dt>
        <dd>{room.building.name}</dd>
        <dt className="text-muted-foreground">Area</dt>
        <dd>{room.name}</dd>
        <dt className="text-muted-foreground">Description</dt>
        <dd>{room.description ?? "None"}</dd>
        <dt className="text-muted-foreground">Link</dt>
        <dd className="font-mono text-[13px]">{roomPath(room)}</dd>
      </dl>
      <p className="text-[13px] text-muted-foreground">Change these with the pencil beside the area name.</p>
      <Button onClick={onNext}>Next: pair the camera unit</Button>
    </div>
  );
}

function PairStep({
  room,
  unitOnline,
  liveFrame,
  now,
  onNext,
}: {
  room: PublicRoom;
  unitOnline: boolean;
  liveFrame: LiveFrame | null;
  now: number;
  onNext: () => void;
}) {
  const router = useRouter();
  const frame = useLiveFrame(unitOnline ? liveFrame : null, false);
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-4">
        <PairCard rooms={[]} fixedRoomId={room.id} onPaired={() => router.refresh()} />
        {liveFrame ? (
          <Button variant="outline" onClick={onNext}>
            Next: draw zones
          </Button>
        ) : null}
      </div>
      <div>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
          {frame.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame.src} alt="" className="absolute inset-0 h-full w-full object-fill" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
              <p className="text-[15px] font-medium">Waiting for the camera unit</p>
              <p className="text-[13px] text-muted-foreground">
                The frame appears here a few seconds after pairing.
              </p>
            </div>
          )}
        </div>
        {liveFrame ? (
          <p className={cn("mt-2 text-[13px]", unitOnline ? "text-muted-foreground" : "text-state-full")}>
            {liveFrame.unitName},{" "}
            {unitOnline
              ? `online, ${durationText(liveFrame.lastSeen, now)} ago`
              : `offline, ${liveFrame.lastSeen ? durationText(liveFrame.lastSeen, now) : "never seen"}`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PreviewStep({
  room,
  initialCounts,
  unitOnline,
}: {
  room: PublicRoom;
  initialCounts: ZoneCount[];
  unitOnline: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState(room.published);
  const unit = room.units[0];
  const unnamed = room.zones.filter((z) => !z.name.trim()).length;

  function publish() {
    setPublished(true);
    startTransition(async () => {
      const result = await setRoomPublished(room.id, true);
      if (result.error) {
        toast(result.error);
        setPublished(false);
        return;
      }
      router.refresh();
    });
  }

  const rows: [string, string, boolean][] = [
    ["Building and area", `${room.building.name}, ${room.name}`, true],
    ["Camera unit online", unit ? (unitOnline ? `${unit.name}, online` : `${unit.name}, offline`) : "Not paired", unitOnline],
    [
      "Zones",
      room.zones.length === 0
        ? "None yet"
        : `${room.zones.length}, ${unnamed === 0 ? "all named" : `${unnamed} unnamed`}`,
      room.zones.length > 0 && unnamed === 0,
    ],
    ["Link slug", roomPath(room), true],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-12">
      <div className="rounded-lg border bg-background p-4">
        <RoomView room={room} initialCounts={initialCounts} embedded />
      </div>
      <div className="space-y-6">
        <div>
          <h2 className="text-[15px] font-semibold">Ready to publish</h2>
          <dl className="mt-5 divide-y border-y text-sm">
            {rows.map(([label, value, ok]) => (
              <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2">
                <dt>{label}</dt>
                <dd className={cn("text-right", ok ? "text-muted-foreground" : "text-state-shared")}>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {published ? (
          <div className="space-y-2">
            <p className="text-sm">Published.</p>
            <Button asChild variant="outline">
              <Link href={roomPath(room)} target="_blank">
                Open the public page
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button size="lg" onClick={publish} disabled={pending || room.zones.length === 0}>
              Publish
            </Button>
            <p className="text-[13px] text-muted-foreground">
              Appears on the public map at once. Unpublish any time with the switch above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
