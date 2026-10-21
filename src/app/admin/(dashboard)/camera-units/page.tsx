import { redirect } from "next/navigation";

// Camera units live on the overview now. Older QR codes still point here.
export default async function CameraUnitsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  redirect(code ? `/admin?code=${encodeURIComponent(code)}` : "/admin");
}
