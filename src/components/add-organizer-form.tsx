"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addApprovedOrganizerAction,
  type AddOrganizerState,
} from "@/app/admin/organizers/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AddOrganizerForm() {
  const [state, formAction, pending] = useActionState<AddOrganizerState, FormData>(
    addApprovedOrganizerAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      toast.success("Organizer whitelisted", {
        description: "They can now sign up or sign in to access organizer features.",
      });
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whitelist organizer</CardTitle>
        <CardDescription>
          Approved organizers can create events, author problems, and run live
          contests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction}>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-end">
              <Field>
                <FieldLabel htmlFor="email">Email address</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="organizer@university.edu"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="note">Organization / Note (Optional)</FieldLabel>
                <Input
                  id="note"
                  name="note"
                  placeholder="e.g. Stanford ACM, Club Lead"
                  autoComplete="off"
                  maxLength={120}
                />
              </Field>

              <Button type="submit" disabled={pending}>
                <UserPlus data-icon="inline-start" />
                {pending ? "Adding…" : "Add organizer"}
              </Button>
            </div>

            {state && "error" in state ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
