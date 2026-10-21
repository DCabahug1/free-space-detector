import Link from "next/link";
import { AccountControl } from "@/components/account-control";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold">
            Spot
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <AccountControl />
        </div>
      </div>
    </header>
  );
}
