import { redirect } from "next/navigation";
import { LockedScreen } from "@/components/locked-screen";
import { SignOutButton } from "@/components/sign-out-button";
import { requireParticipant } from "@/lib/auth/guards";
import { loadParticipantContext } from "@/lib/participants/queries";

export const dynamic = "force-dynamic";

/**
 * The terminal screen (SPEC §5.8). The guard is the same for every participant
 * page: a locked or ended contest lands here, and an open one goes back to the
 * lobby. This page reads the participant row and nothing else — the code is
 * never loaded, so it cannot be shown or edited.
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

  return (
    <LockedScreen
      eventTitle={event.title}
      participantName={participant.displayName}
      reason={participant.lockoutReason}
      joinedAt={participant.joinedAt}
      lockedAt={participant.lockedAt}
      action={<SignOutButton />}
    />
  );
}
