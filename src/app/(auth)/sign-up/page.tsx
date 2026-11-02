import { Card, CardContent } from "@/components/legacy-ui/card";
import { AuthForm } from "@/components/auth-form";
import { getViewer, landingFor } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 text-lg font-semibold">Register</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Email and password only. No verification step.
        </p>
        <AuthForm mode="sign-up" />
      </CardContent>
    </Card>
  );
}
