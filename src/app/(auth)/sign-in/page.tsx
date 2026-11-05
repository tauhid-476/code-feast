import { SignInPage } from "@/components/sign-in-page";
import { getViewer, landingFor } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignIn() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  return <SignInPage />;
}
