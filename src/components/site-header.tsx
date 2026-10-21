import Link from "next/link";
import { AccountControl } from "@/components/account-control";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  // Shows the "All areas" link back to the map.
  back?: boolean;
}

export function SiteHeader({ back }: SiteHeaderProps) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold">
            Spot
          </Link>
          {back ? (
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              All areas
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AccountControl />
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ text }: { text?: string }) {
  return (
    <footer className="mx-auto w-full max-w-[1120px] px-4 py-8 text-[13px] text-muted-foreground">
      {text ?? "Counts from camera units. No video leaves the camera unit."}
    </footer>
  );
}
