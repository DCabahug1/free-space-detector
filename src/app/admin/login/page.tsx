import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[360px] flex-col justify-center px-4 py-12">
      <Link href="/" className="text-lg font-semibold">
        Spot
      </Link>
      <h1 className="mt-6 text-2xl font-semibold">Staff sign in</h1>
      <div className="mt-6">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-8 text-[13px] text-muted-foreground">
        Accounts are created by hand. No sign up.
      </p>
    </main>
  );
}
