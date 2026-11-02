"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createEventAction,
  type CreateEventState,
} from "@/app/admin/events/actions";
import { E2BApiKeyGuide } from "@/components/e2b-api-key-guide";
import { Alert, AlertDescription } from "@/components/legacy-ui/alert";
import { Button } from "@/components/legacy-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/legacy-ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/legacy-ui/field";
import { Input } from "@/components/legacy-ui/input";

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
    <Card>
      <CardHeader>
        <CardTitle>New event</CardTitle>
        <CardDescription>
          A title and a duration are enough to start. The join code is generated
          for you and can change until the event goes live.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction}>
          <FieldGroup>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-end">
              <Field>
                <FieldLabel htmlFor="title">Title</FieldLabel>
                <Input
                  id="title"
                  name="title"
                  placeholder="Friday Night Contest"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="durationMinutes">Minutes</FieldLabel>
                <div className="relative">
                  <Input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    defaultValue={90}
                    className="tabular pr-9"
                    required
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
                    min
                  </span>
                </div>
              </Field>

              <Button type="submit" disabled={pending}>
                <Plus data-icon="inline-start" />
                {pending ? "Creating…" : "Create event"}
              </Button>
            </div>

            <div className="mt-2 space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <Field>
                <FieldLabel htmlFor="e2bApiKey">
                  E2B API Key (BYOK - Optional)
                </FieldLabel>
                <Input
                  id="e2bApiKey"
                  name="e2bApiKey"
                  type="password"
                  placeholder="e2b_... (leaves blank to use platform default)"
                  autoComplete="off"
                />
                <span className="text-xs text-muted-foreground">
                  If left blank, code runs fall back to the platform environment
                  variable <code>E2B_API_KEY</code>.
                </span>
              </Field>

              <E2BApiKeyGuide />
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
