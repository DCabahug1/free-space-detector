"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, type SignInState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SignInState = {};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      {state.error ? (
        <p className="text-[13px] text-state-full" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
