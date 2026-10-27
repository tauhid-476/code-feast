"use client";

import { useActionState } from "react";
import { joinAction } from "@/app/join/actions";

export function JoinCodeForm() {
  const [state, formAction, pending] = useActionState(joinAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="label" htmlFor="code">
        Join code
      </label>
      <input
        id="code"
        name="code"
        className="input mono text-center text-lg uppercase tracking-[0.4em]"
        placeholder="ABC123"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={6}
        required
      />
      {state?.error ? (
        <p className="banner banner-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Checking…" : "Enter event"}
      </button>
    </form>
  );
}
