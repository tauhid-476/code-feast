import { redirect } from "next/navigation";
import { EditorPreload } from "@/components/editor-preload";
import { FullscreenGate } from "@/components/fullscreen-gate";
import { LobbyLiveWatcher } from "@/components/lobby-live-watcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requireParticipant } from "@/lib/auth/guards";
import { readContestGate } from "@/lib/participants/gate";
import { loadParticipantContext } from "@/lib/participants/queries";
import { lobbyDestination } from "@/lib/participants/routes";
import { now as serverNow } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function LobbyPage({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const viewer = await requireParticipant();
  const context = await loadParticipantContext(code, viewer.id);

  // No entry for this event: the code is not theirs to wait in.
  if (!context || !context.participant) redirect("/join");

  // Live events stay here until the fullscreen gate is passed. The gate lives
  // in the participants module so no page drifts.
  const gate = await readContestGate(code, {
    eventId: context.event.id,
    participantId: context.participant.id,
  });
  const destination = lobbyDestination(context, { entered: gate });
  if (destination) redirect(destination);

  const { event, participant } = context;
  const live = event.status === "live";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="label">{live ? "Start gate" : "Lobby"}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {live ? "Enter the contest" : "You&apos;re in"}
            </h1>
          </div>
          <SignOutButton />
        </div>

        {live ? (
          <FullscreenGate
            code={event.code}
            serverNow={serverNow().toISOString()}
            deadlineAt={event.deadlineAt?.toISOString() ?? null}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-5">
              <div>
                <p className="label">Event</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-balance">
                  {event.title}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="tabular">
                    {event.durationMinutes} min
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span className="mono tracking-[0.18em]">{event.code}</span>
                </p>
              </div>

              <Separator />

              <div>
                <p className="label">Participant</p>
                <p className="mt-1 text-sm font-medium">
                  {participant.displayName}
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background/40 p-4">
                <p className="text-sm font-medium">Waiting for the organizer</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The shared clock starts for everyone at once. Nothing is shown
                  about the problems until then.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {live
            ? "The contest opens in fullscreen. Your code is autosaved."
            : "Keep this tab open. The event begins when the organizer starts it."}
        </p>
      </div>
      {live ? null : <LobbyLiveWatcher />}
      <EditorPreload />
    </main>
  );
}
