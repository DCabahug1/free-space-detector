import { Suspense } from "react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { LoginForm } from "./login-form";

// The whole page is the band. One card in the middle.
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-band px-5 py-12">
      <main className="flex w-full max-w-[416px] flex-col gap-7 rounded-lg border bg-card p-7 pt-8 text-card-foreground shadow-lg">
        <div className="flex flex-col gap-4">
          <BackLink href="/" label="Back to map" className="mb-2" />
          <Link href="/" className="w-fit text-lg font-bold tracking-[-0.01em] text-primary">
            Spot
          </Link>
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.01em]">Staff sign in</h1>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-[13px] text-muted-foreground">Accounts are created by hand. No sign up.</p>
      </main>
    </div>
  );
}
