import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { Band, bandGhostClass, bandIconClass } from "@/components/band";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface AdminHeaderProps {
  // The overview is wider than the setup page.
  wide?: boolean;
}

// Top band for the admin pages: wordmark and "Admin" label. Right: Public map,
// Sign out, theme toggle.
export function AdminHeader({ wide }: AdminHeaderProps) {
  return (
    <Band>
      <div className={cn("mx-auto w-full", wide ? "max-w-[1360px] px-6" : "max-w-[1120px] px-4")}>
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Link href="/" className="text-lg font-bold">
              Spot
            </Link>
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-band-muted">Admin</span>
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
      </div>
    </Band>
  );
}
