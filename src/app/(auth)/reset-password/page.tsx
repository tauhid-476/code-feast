import { ResetPasswordPage } from "@/components/reset-password-page";
import { getViewer, landingFor } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  const params = await searchParams;
  return <ResetPasswordPage token={params.token} error={params.error} />;
}
