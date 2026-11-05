import { ForgotPasswordPage } from "@/components/forgot-password-page";
import { getViewer, landingFor } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ForgotPassword() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  return <ForgotPasswordPage />;
}
