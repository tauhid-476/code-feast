import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getViewer, landingFor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-lg font-semibold">Register</h2>
      <p className="mb-5 text-sm text-muted">
        Email and password only. No verification step.
      </p>
      <AuthForm mode="sign-up" />
    </div>
  );
}
