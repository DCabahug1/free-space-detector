"use client";

import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Demo build: always signed in as a fixed demo admin, so the account menu
// is the way into the admin app. No admin link anywhere else on the public
// pages.
export function AccountControl() {
  const name = "Demo admin";
  const initial = "D";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-band-2 dark:hover:bg-band-2"
          aria-label="Account menu"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-band-accent text-sm font-semibold text-band">
            {initial}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          Signed in as {name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin">Admin</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut()}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
