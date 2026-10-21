import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { Band, bandGhostClass, bandIconClass } from "@/components/band";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface AdminHeaderProps {
  // The overview is wider than the setup page.
  wide?: boolean;
  // Rendered under the top row, still on the band (the overview's tabs).
  children?: React.ReactNode;
}

// Top band for the admin pages: wordmark, "Admin" label, Areas link. Right:
// Public map, Sign out, theme toggle.
export function AdminHeader({ wide, children }: AdminHeaderProps) {
  return (
    <Band>
      <div className={cn("mx-auto w-full", wide ? "max-w-[1360px] px-6" : "max-w-[1120px] px-4")}>
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Link href="/" className="text-lg font-bold">
              Spot
            </Link>
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-band-muted">Admin</span>
            <Link href="/admin" className="text-sm text-band-muted hover:text-band-foreground">
              Areas
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className={bandGhostClass}>
              <Link href="/">Public map</Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className={bandGhostClass}>
                Sign out
              </Button>
            </form>
            <ThemeToggle className={bandIconClass} />
          </div>
        </div>
        {children}
      </div>
    </Band>
  );
}
