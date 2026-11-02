import { ModeToggle } from "@/components/mode-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { JoinCodeForm } from "@/components/join-code-form";
import { requireParticipant } from "@/lib/auth/guards";
import { Card, CardBody } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const participant = await requireParticipant();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="label">Code Feast</p>
            <h1 className="mt-1 text-xl font-semibold">Join an event</h1>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <SignOutButton />
          </div>
        </div>

        <Card className="backdrop-blur-none sm:opacity-100">
          <CardBody>
            <p className="mb-4 text-sm text-muted-foreground">
              Signed in as{" "}
              <span className="text-foreground">{participant.email}</span>. Enter
              the code your organizer shared.
            </p>
            <JoinCodeForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
