"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addApprovedOrganizerAction,
  type AddOrganizerState,
} from "@/app/admin/organizers/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardText, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
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
    <Card className="backdrop-blur-none sm:opacity-100">
      <CardBody className="gap-3">
        <CardTitle>Whitelist organizer</CardTitle>
        <CardText className="line-clamp-none">
          Approved organizers can create events, author problems, and run live
          contests.
        </CardText>
        <form ref={formRef} action={formAction} className="mt-1">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-end">
              <Field label="Email address">
                <Input
                  name="email"
                  type="email"
                  placeholder="organizer@university.edu"
                  autoComplete="off"
                  required
                />
              </Field>

              <Field label="Organization / Note (Optional)">
                <Input
                  name="note"
                  placeholder="e.g. Stanford ACM, Club Lead"
                  autoComplete="off"
                  maxLength={120}
                />
              </Field>

              <Button type="submit" disabled={pending}>
                <UserPlus />
                {pending ? "Adding…" : "Add organizer"}
              </Button>
            </div>

            {state && "error" in state ? (
              <Alert tone="danger">{state.error}</Alert>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
