"use client";

import { useTransition } from "react";
import { Trash2, Mail, Building } from "lucide-react";
import { toast } from "sonner";
import { removeApprovedOrganizerAction } from "@/app/admin/organizers/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardText, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApprovedOrganizer } from "@/lib/organizers/whitelist";

export function OrganizersList({
  organizers,
}: {
  organizers: ApprovedOrganizer[];
}) {
  const [pending, startTransition] = useTransition();

  const handleRemove = (id: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke organizer access for ${email}?`)) {
      return;
    }
    startTransition(async () => {
      const result = await removeApprovedOrganizerAction(id);
      if (result && "error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Revoked access for ${email}`);
      }
    });
  };

  return (
    <Card className="backdrop-blur-none sm:opacity-100">
      <CardBody className="gap-3">
        <CardTitle>Whitelisted Organizers</CardTitle>
        <CardText className="line-clamp-none">
          Users in this list have permission to access the admin panel, create contests, and manage problem sets.
        </CardText>
        {organizers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No organizers have been manually whitelisted yet. (Super-admins configured via env still have full access.)
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Note / Affiliation</TableHead>
                <TableHead>Added On</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizers.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground" />
                      {org.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    {org.note ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
                        <Building className="size-3.5" />
                        {org.note}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60 italic">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => handleRemove(org.id, org.email)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Revoke ${org.email}`}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
