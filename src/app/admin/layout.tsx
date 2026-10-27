import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireOrganizer } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const organizer = await requireOrganizer();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          <Link href="/admin/events" className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight">Code Feast</span>
            <span className="label">Organizer</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link className="btn btn-ghost" href="/admin/events">
              Events
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-faint sm:inline">
              {organizer.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
