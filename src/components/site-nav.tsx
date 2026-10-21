import Link from "next/link";
import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteNavProps {
  current: "map" | "admin";
  right?: React.ReactNode;
}

export function SiteNav({ current, right }: SiteNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Radar className="size-5 text-primary" aria-hidden />
          Live occupancy
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/" active={current === "map"}>
            Map
          </NavLink>
          <NavLink href="/admin" active={current === "admin"}>
            Admin
          </NavLink>
          {right}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground"
      )}
    >
      {children}
    </Link>
  );
}
