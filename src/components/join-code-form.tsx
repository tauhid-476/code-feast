"use client";

import { useActionState } from "react";
import { joinAction } from "@/app/join/actions";
import { Alert, AlertDescription } from "@/components/legacy-ui/alert";
import { Button } from "@/components/legacy-ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/legacy-ui/field";
import { Input } from "@/components/legacy-ui/input";

export function JoinCodeForm() {
  const [state, formAction, pending] = useActionState(joinAction, null);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="code">Join code</FieldLabel>
          <Input
            id="code"
            name="code"
            className="mono h-12 text-center text-lg tracking-[0.4em] uppercase"
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={6}
            required
          />
        </Field>

        {state?.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Checking…" : "Enter event"}
        </Button>
      </FieldGroup>
    </form>
  );
}
