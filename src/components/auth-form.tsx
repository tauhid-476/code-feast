"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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

    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({
              email,
              password,
              name: email.split("@")[0],
            })
          : await authClient.signIn.email({ email, password });

      if (result?.error) {
        setError(result.error.message ?? "That did not work. Check your details.");
        return;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Invalid email or password. If you do not have an account yet, please sign up first.";
      setError(message);
      return;
    }

    // The root route decides where this account belongs.
    startTransition(() => {
      router.push("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="flex flex-col gap-4">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field
          label="Password"
          hint={mode === "sign-up" ? "At least 8 characters." : undefined}
        >
          <Input
            type="password"
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? (
          <Alert tone="danger">
            {error}
          </Alert>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "sign-up" ? (
            <>
              Already registered?{" "}
              <Link className="text-primary underline underline-offset-2" href="/sign-in">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{" "}
              <Link className="text-primary underline underline-offset-2" href="/sign-up">
                Register
              </Link>
            </>
          )}
        </p>
      </div>
    </form>
  );
}
