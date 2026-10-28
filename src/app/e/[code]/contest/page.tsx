import { redirect } from "next/navigation";
import { ContestWorkspace } from "@/components/contest-workspace";
import { requireParticipant } from "@/lib/auth/guards";
import { listDrafts } from "@/lib/drafts/manage";
import { listContestProblems } from "@/lib/problems/contest";
import { readContestGate } from "@/lib/participants/gate";
import { markSolving } from "@/lib/participants/lockout";
import { loadParticipantContext } from "@/lib/participants/queries";
import { contestDestination } from "@/lib/participants/routes";
import { now as serverNow } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * The contest route. Reachable only with the fullscreen gate cookie the enter
 * action sets: a typed URL without it goes back to the Lobby gate. The gate, the
 * deadline lockout, and the ended-event redirect are all decided by
 * `contestDestination`, so this page cannot drift from the lobby.
 */
export default async function ContestPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const viewer = await requireParticipant();
  const context = await loadParticipantContext(code, viewer.id);

  if (!context || !context.participant) redirect("/join");

  const gate = await readContestGate(code, {
    eventId: context.event.id,
    participantId: context.participant.id,
  });
  const destination = contestDestination(context, { entered: gate });
  if (destination) redirect(destination);

  // Entering is what makes a participant "solving" (ticket 08 leaves Start
  // alone). The enter action writes this; repeating it here heals a lost write
  // and covers a refresh.
  if (context.participant.status === "joined") {
    await markSolving(context.participant.id, serverNow());
  }

  const [problems, drafts] = await Promise.all([
    listContestProblems(context),
    listDrafts(context),
  ]);

  return (
    <ContestWorkspace
      code={context.event.code}
      eventTitle={context.event.title}
      participantId={context.participant.id}
      participantName={context.participant.displayName}
      problems={problems}
      drafts={drafts.map((draft) => ({
        problemId: draft.problemId,
        language: draft.language,
        code: draft.code,
        updatedAt: draft.updatedAt.toISOString(),
      }))}
      serverNow={serverNow().toISOString()}
      deadlineAt={context.event.deadlineAt?.toISOString() ?? null}
    />
  );
}
