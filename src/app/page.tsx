import { redirect } from "next/navigation";
import { getViewer, landingFor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewer();
  redirect(landingFor(viewer));
}
