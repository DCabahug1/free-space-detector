import { Suspense } from "react";
import { SiteNav } from "@/components/site-nav";
import { AdminSubNav, SignOutButton } from "@/components/admin-nav";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteNav current="admin" right={<SignOutButton />} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
        <Suspense fallback={<div className="mb-6 h-9 border-b" />}>
          <AdminSubNav />
        </Suspense>
        {children}
      </main>
    </>
  );
}
