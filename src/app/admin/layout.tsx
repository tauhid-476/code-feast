import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { ModeToggle } from "@/components/mode-toggle";
import { requireOrganizer } from "@/lib/auth/guards";
import { isSuperAdminEmail } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const organizer = await requireOrganizer();
  const isSuperAdmin = isSuperAdminEmail(organizer.email);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6">
          <Link href="/admin/events" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Code Feast"
              className="h-7 w-auto max-w-[120px] object-contain rounded"
            />
            <span className="label">Organizer</span>
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" render={<Link href="/admin/events" />}>
              Events
            </Button>
            {isSuperAdmin ? (
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/admin/organizers" />}
              >
                Organizers
              </Button>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {organizer.email}
            </span>
            <ModeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
