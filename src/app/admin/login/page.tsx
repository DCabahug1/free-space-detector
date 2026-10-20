import { Suspense } from "react";
import { SiteNav } from "@/components/site-nav";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <>
      <SiteNav current="admin" />
      <main className="mx-auto flex w-full max-w-6xl items-start justify-center px-4 py-12 md:py-20">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
