import { cn } from "@/lib/utils";

const SIZE = {
  // xs is the setup page's 320 px preview of the area page.
  xs: "h-5 px-1.5 text-[11px]",
  sm: "h-7 px-2 text-sm",
  md: "h-9 px-2.5 text-xl",
} as const;

interface CountPillProps {
  // A CSS color from availabilityColor: the text, with a tint of it behind.
  color: string;
  size?: keyof typeof SIZE;
  className?: string;
  children: React.ReactNode;
}

// A count in a rounded-md pill, the same shape as the badges and tabs.
// Shared by zone tiles, area rows and building headers.
export function CountPill({ color, size = "sm", className, children }: CountPillProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-md font-mono font-bold whitespace-nowrap tabular-nums",
        "bg-[color-mix(in_oklch,var(--pill)_14%,transparent)] text-[var(--pill)] transition-colors duration-300",
        SIZE[size],
        className
      )}
      style={{ "--pill": color } as React.CSSProperties}
    >
      {children}
    </span>
  );
}
