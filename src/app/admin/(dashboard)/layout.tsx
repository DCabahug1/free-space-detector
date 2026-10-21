import { AdminHeader } from "@/components/admin-header";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AdminHeader />
      <main className="mx-auto w-full max-w-[1120px] px-4 py-6 md:py-8">{children}</main>
    </>
  );
}
