import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { requireParticipant } from "@/lib/auth/guards";
import { loadParticipantContext } from "@/lib/participants/queries";
import { contestDestination } from "@/lib/participants/routes";

export const dynamic = "force-dynamic";

/**
 * Placeholder only: ticket 09 replaces this body with the fullscreen gate, the
 * split pane, the editor, and autosave. The gate below stays.
 */
export default async function ContestPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const viewer = await requireParticipant();
  const context = await loadParticipantContext(code, viewer.id);

  if (!context || !context.participant) redirect("/join");

  const destination = contestDestination(context);
  if (destination) redirect(destination);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="label">Contest</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {context.event.title}
            </h1>
          </div>
          <SignOutButton />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-medium">The contest view is coming.</p>
            <p className="text-sm text-muted-foreground">
              Your event is live. The problem list and editor open here.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
