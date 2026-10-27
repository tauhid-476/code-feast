"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

type Mode = "sign-in" | "sign-up";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: email.split("@")[0] })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? "That did not work. Check your details.");
      return;
    }

    // The root route decides where this account belongs.
    startTransition(() => {
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="input"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {mode === "sign-up" ? (
          <p className="text-xs text-faint">At least 8 characters.</p>
        ) : null}
      </div>

      {error ? (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="btn btn-primary" type="submit" disabled={pending}>
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        {mode === "sign-up" ? (
          <>
            Already registered?{" "}
            <Link className="text-accent underline underline-offset-2" href="/sign-in">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link className="text-accent underline underline-offset-2" href="/sign-up">
              Register
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
