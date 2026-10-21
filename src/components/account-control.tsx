"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { signOut } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import { bandIconClass } from "@/components/band";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Signed out: a person outline that opens "Staff sign in". Signed in: a
// band-accent circle with the first initial that opens the account menu. No admin link
// anywhere else on the public pages.
export function AccountControl() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!user) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={bandIconClass} aria-label="Account">
            <UserRound aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-1">
          <Button asChild variant="ghost" className="w-full justify-start">
            <Link href="/admin/login">Staff sign in</Link>
          </Button>
        </PopoverContent>
      </Popover>
    );
  }

  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? "staff";
  const initial = name.trim().charAt(0).toUpperCase() || "S";

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
