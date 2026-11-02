"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createEventAction,
  type CreateEventState,
} from "@/app/admin/events/actions";
import { E2BApiKeyGuide } from "@/components/e2b-api-key-guide";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardText, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function CreateEventForm() {
  const [state, formAction, pending] = useActionState<CreateEventState, FormData>(
    createEventAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (!state || !("created" in state)) return;
    if (announced.current === state.created.id) return;

    announced.current = state.created.id;
    formRef.current?.reset();
    toast.success("Event created", {
      description: `Join code ${state.created.code}`,
    });
  }, [state]);

  return (
    <Card className="backdrop-blur-none sm:opacity-100">
      <CardBody className="gap-3">
        <CardTitle>New event</CardTitle>
        <CardText className="line-clamp-none">
          A title and a duration are enough to start. The join code is generated
          for you and can change until the event goes live.
        </CardText>
        <form ref={formRef} action={formAction} className="mt-1">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-end">
              <Field label="Title">
                <Input
                  name="title"
                  placeholder="Friday Night Contest"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>

              <div className="relative">
                <Field label="Minutes">
                  <Input
                    name="durationMinutes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    defaultValue={90}
                    className="tabular pr-9"
                    required
                  />
                </Field>
                <span className="pointer-events-none absolute right-2.5 bottom-0 flex h-9 items-center text-xs text-muted-foreground">
                  min
                </span>
              </div>

              <Button type="submit" disabled={pending}>
                <Plus />
                {pending ? "Creating…" : "Create event"}
              </Button>
            </div>

            <div className="mt-2 flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <Field
                label="E2B API Key (BYOK - Optional)"
                hint={
                  <>
                    If left blank, code runs fall back to the platform
                    environment variable <code>E2B_API_KEY</code>.
                  </>
                }
              >
                <Input
                  name="e2bApiKey"
                  type="password"
                  placeholder="e2b_... (leaves blank to use platform default)"
                  autoComplete="off"
                />
              </Field>

              <E2BApiKeyGuide />
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
