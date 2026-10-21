import { cn } from "@/lib/utils";

// The header band is the primary color. Controls on it use these classes.

// Icon button on the band: band-2 fill, white glyph.
export const bandIconClass =
  "bg-band-2 text-band-foreground hover:bg-band-2/80 hover:text-band-foreground dark:hover:bg-band-2/80";

// Text button or link on the band: no fill, white text.
export const bandGhostClass =
  "text-band-foreground hover:bg-band-2 hover:text-band-foreground dark:hover:bg-band-2";

// Outline button on the band: band-2 fill, no border, no shadow.
export const bandOutlineClass =
  "border-transparent bg-band-2 text-band-foreground shadow-none hover:bg-band-2/80 hover:text-band-foreground dark:border-transparent dark:bg-band-2 dark:hover:bg-band-2/80";

// Centered content column shared by the public pages and the admin overview.
export function Wrap({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1120px] px-4", className)}>{children}</div>;
}

// The band itself, full width.
export function Band({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("bg-band text-band-foreground", className)}>{children}</div>;
}
