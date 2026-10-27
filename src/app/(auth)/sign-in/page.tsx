import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getViewer, landingFor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  return (
    <div className="card p-6">
      <h2 className="mb-5 text-lg font-semibold">Sign in</h2>
      <AuthForm mode="sign-in" />
    </div>
  );
}
