import { SignUpPage } from "@/components/sign-up-page";
import { getViewer, landingFor } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignUp() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  return <SignUpPage />;
}
