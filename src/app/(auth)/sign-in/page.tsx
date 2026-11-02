import { Card, CardBody } from "@/components/ui/card";
import { AuthForm } from "@/components/auth-form";
import { getViewer, landingFor } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") redirect(landingFor(viewer));

  return (
    <Card className="backdrop-blur-none sm:opacity-100">
      <CardBody>
        <h2 className="mb-5 text-lg font-semibold">Sign in</h2>
        <AuthForm mode="sign-in" />
      </CardBody>
    </Card>
  );
}
