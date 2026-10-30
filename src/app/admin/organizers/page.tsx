import { requireSuperAdmin } from "@/lib/auth/guards";
import { listApprovedOrganizers } from "@/lib/organizers/whitelist";
import { AddOrganizerForm } from "@/components/add-organizer-form";
import { OrganizersList } from "@/components/organizers-list";

export const dynamic = "force-dynamic";

export default async function AdminOrganizersPage() {
  await requireSuperAdmin();
  const organizers = await listApprovedOrganizers();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Organizer Whitelist
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage organizers who have permissions to create and host coding events.
        </p>
      </div>

      <AddOrganizerForm />

      <OrganizersList organizers={organizers} />
    </div>
  );
}
