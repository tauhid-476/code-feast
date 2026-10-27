import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-md p-8 text-center">
        <p className="label">403 · Refused</p>
        <h1 className="mt-3 text-xl font-semibold">Not your surface</h1>
        <p className="mt-2 text-sm text-muted">
          This account is not an organizer. Nothing here is available to you.
        </p>
        <Link href="/" className="btn mt-6">
          Go to your landing page
        </Link>
      </div>
    </main>
  );
}
