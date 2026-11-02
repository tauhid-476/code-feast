import { redirect } from "next/navigation";
import { getViewer, landingFor } from "@/lib/auth/session";
import { LandingPage } from "@/components/landing-page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  if (viewer.kind !== "anonymous") {
    redirect(landingFor(viewer));
  }
  return <LandingPage />;
}
