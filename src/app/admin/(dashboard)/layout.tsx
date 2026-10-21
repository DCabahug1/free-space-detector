// Each admin page renders its own AdminHeader: the overview puts its tabs on
// the band, the setup page is wider.
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
