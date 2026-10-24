import { cn } from "@/lib/utils";
import type { Level } from "@/lib/occupancy";

const SIZE = {
  // xs is the setup page's 320 px preview of the area page, and the legend.
  xs: "h-5 px-1.5 text-[11px]",
  sm: "h-7 px-2.5 text-[13px]",
  md: "h-8 px-2.5 text-base",
} as const;

// Three levels of emphasis, no traffic-light colors: empty is solid navy
// (the best place to go), some seats a periwinkle tint, full a quiet grey
// outline, offline a dashed one. In dark mode primary is periwinkle, so
// empty turns into a periwinkle fill with navy text.
const TONE: Record<Level, string> = {
  empty: "border-primary bg-primary text-primary-foreground",
  some: "border-transparent bg-[color-mix(in_oklch,var(--seat-some)_38%,var(--card))] text-primary",
  full: "border-border bg-card text-muted-foreground",
  unknown: "border-dashed border-border bg-card text-muted-foreground",
};

interface CountPillProps {
  tone: Level;
  size?: keyof typeof SIZE;
  className?: string;
  children: React.ReactNode;
}

// A count or status in a rounded-md pill, the same shape as the tabs and
// badges. Shared by zone tiles, area rows, building headers and the legend.
export function CountPill({ tone, size = "sm", className, children }: CountPillProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-md border font-mono font-semibold whitespace-nowrap tabular-nums transition-colors duration-300",
        SIZE[size],
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// "12 free", "Full" or "? unknown" for an area or a building.
export function FreePill({ level, free }: { level: Level; free: number }) {
  return (
    <CountPill tone={level}>
      {level === "unknown" ? "?" : level === "full" ? null : free}
      <span className="font-sans text-xs font-medium">
        {level === "unknown" ? "unknown" : level === "full" ? "Full" : "free"}
      </span>
    </CountPill>
  );
}
