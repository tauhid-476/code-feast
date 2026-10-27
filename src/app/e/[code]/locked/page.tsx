import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { requireParticipant } from "@/lib/auth/guards";
import {
  loadParticipantContext,
  type LockoutReason,
} from "@/lib/participants/queries";

export const dynamic = "force-dynamic";

const REASON_TEXT: Record<LockoutReason, string> = {
  submitted: "You submitted, so your code is frozen.",
  deadline: "The shared clock reached its deadline.",
  eliminated: "You were locked out after three strikes.",
};

/**
 * Placeholder only: ticket 11 builds the terminal screen with the submission
 * and elapsed time. The guard below stays.
 */
export default async function LockedPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const viewer = await requireParticipant();
  const context = await loadParticipantContext(code, viewer.id);

  if (!context || !context.participant) redirect("/join");

  const { event, participant } = context;
  if (participant.status !== "locked_out" && event.status !== "ended") {
    redirect(`/e/${event.code}`);
  }

  const reason = participant.lockoutReason;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="label">Locked</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {event.title}
            </h1>
          </div>
          <SignOutButton />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm font-medium">Your contest is locked.</p>
            <p className="text-sm text-muted-foreground">
              {reason ? REASON_TEXT[reason] : "This event has ended."}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
