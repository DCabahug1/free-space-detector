import Link from "next/link";
import { AccountControl } from "@/components/account-control";
import { Band, Wrap, bandIconClass } from "@/components/band";
import { ThemeToggle } from "@/components/theme-toggle";

// Public pages: the band with the wordmark, theme toggle and account control.
export function SiteHeader() {
  return (
    <Band>
      <Wrap className="flex h-14 max-w-[1280px] items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold">
          Spot
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle className={bandIconClass} />
          <AccountControl />
        </div>
      </Wrap>
    </Band>
  );
}
