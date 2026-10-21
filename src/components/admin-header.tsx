import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

// Top bar for the admin overview and the setup page: wordmark, "Admin"
// label, Rooms link. Right: Public map, Sign out.
export function AdminHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold">
            Spot
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Admin
          </span>
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            Rooms
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Public map</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
