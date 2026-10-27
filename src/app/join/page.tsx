import { SignOutButton } from "@/components/sign-out-button";
import { JoinCodeForm } from "@/components/join-code-form";
import { requireParticipant } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  const participant = await requireParticipant();

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="label">Code Feast</p>
            <h1 className="mt-1 text-xl font-semibold">Join an event</h1>
          </div>
          <SignOutButton />
        </div>

        <div className="card p-6">
          <p className="mb-4 text-sm text-muted">
            Signed in as <span className="text-text">{participant.email}</span>.
            Enter the code your organizer shared.
          </p>
          <JoinCodeForm />
        </div>
      </div>
    </main>
  );
}
