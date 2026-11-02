"use client";

import { useActionState } from "react";
import { joinAction } from "@/app/join/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function JoinCodeForm() {
  const [state, formAction, pending] = useActionState(joinAction, null);

  return (
    <form action={formAction}>
      <div className="flex flex-col gap-4">
        <Field label="Join code">
          <Input
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

        {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Checking…" : "Enter event"}
        </Button>
      </div>
    </form>
  );
}
