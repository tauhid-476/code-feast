import Link from "next/link";

export default function Unauthorized() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-md p-8 text-center">
        <p className="label">401 · Sign in required</p>
        <h1 className="mt-3 text-xl font-semibold">You are not signed in</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in with the account the organizer knows you by.
        </p>
        <Link href="/sign-in" className="btn btn-primary mt-6">
          Sign in
        </Link>
      </div>
    </main>
  );
}
