import { cn } from "@/lib/utils";

export interface SeatMapBuilding {
  id: string;
  name: string;
  free: number;
  // Every camera unit in the building is offline: seats draw as outlines.
  offline: boolean;
  // Left out by the search or the tab: drawn faded.
  shown: boolean;
  // One entry per seating zone, in the admin's order.
  zones: { id: string; capacity: number; taken: number }[];
}

interface SeatMapProps {
  buildings: SeatMapBuilding[];
  // The building last picked here or on the street map.
  activeId: string | null;
  onSelect: (buildingId: string) => void;
  loading?: boolean;
}

// One square per real seat, grouped by table, then by building. A free
// seat at an empty table is navy, a free seat at a table someone is at is
// periwinkle, a taken seat light grey, so empty tables stand out first. A
// building opens its card in the list; a second click clears it.
export function SeatMap({ buildings, activeId, onSelect, loading = false }: SeatMapProps) {
  return (
    <section aria-label="Seat map" className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Seat map</h2>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-seat-free" />
            Empty table
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-seat-some" />
            Free seat
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-seat-taken" />
            Taken
          </span>
        </div>
      </div>
      <ul className="-mx-2 flex flex-col">
        {buildings.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onSelect(b.id)}
              aria-label={`${b.name}: ${b.offline ? "unknown" : `${b.free} seats free`}. Show in list`}
              className={cn(
                "flex w-full flex-col gap-2 rounded-md px-2 py-2.5 text-left transition-[background-color,opacity] duration-300 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                activeId === b.id && "bg-accent hover:bg-accent",
                !b.shown && "opacity-35"
              )}
            >
              <span className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate font-medium">{b.name}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {loading ? "" : b.offline ? "?" : `${b.free} free`}
                </span>
              </span>
              <span className="flex flex-wrap gap-x-2 gap-y-1.5" aria-hidden>
                {b.zones.map((z) => (
                  <span key={z.id} className="flex gap-[3px]">
                    {Array.from({ length: z.capacity }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "size-2.5 rounded-[2px] transition-colors duration-500 motion-reduce:transition-none",
                          loading || b.offline
                            ? "border border-dashed border-input"
                            : i >= z.capacity - z.taken
                              ? "bg-seat-taken"
                              : z.taken === 0
                                ? "bg-seat-free"
                                : "bg-seat-some"
                        )}
                      />
                    ))}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
