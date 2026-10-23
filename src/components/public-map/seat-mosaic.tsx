import { cn } from "@/lib/utils";

const COLS = 14;
const ROWS = 5;
const CELLS = COLS * ROWS;

// A fixed scatter so free seats are spread over the grid rather than filled
// in reading order. Same order on the server and the client.
const ORDER = Array.from({ length: CELLS }, (_, i) => i).sort(
  (a, b) => ((a * 37) % CELLS) - ((b * 37) % CELLS)
);

// The hero's picture of campus: one square per seat slot, lit in the band
// accent for the share of seats free right now, dim for the share taken.
// Squares fade between the two as counts change. Decorative; the number
// beside it says the same thing in text.
export function SeatMosaic({ free, total, className }: { free: number; total: number; className?: string }) {
  const lit = total > 0 ? Math.round((free / total) * CELLS) : 0;
  const isLit = new Set(ORDER.slice(0, lit));
  return (
    <div
      aria-hidden
      className={cn("shrink-0 grid-cols-[repeat(14,14px)] gap-1.5", className)}
    >
      {Array.from({ length: CELLS }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-3.5 rounded-[3px] transition-colors duration-700 motion-reduce:transition-none",
            isLit.has(i) ? "bg-band-accent" : "bg-band-2"
          )}
          style={{ transitionDelay: `${(i % COLS) * 20}ms` }}
        />
      ))}
    </div>
  );
}
