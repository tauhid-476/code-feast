'use client'

import { MailCheck } from 'lucide-react'
import * as React from 'react'

import {
  AuthLink,
  AuthShell,
  Field,
  FormError,
  isEmail,
  SubmitButton,
  TextInput,
  useAuthSubmit,
  type SubmitResult,
} from '@/components/auth-shell'

/**
 * Ask for a reset link, then confirm it was sent. The confirmation reads the
 * same whether or not the email has an account, so the page does not reveal
 * who has signed up.
 */
export function ForgotPasswordPage({
  onSubmit,
  signInHref = '/sign-in',
}: {
  onSubmit?: (values: { email: string }) => SubmitResult
  signInHref?: string
}) {
  const [email, setEmail] = React.useState('')
  const [fieldError, setFieldError] = React.useState<string>()
  const [sent, setSent] = React.useState(false)
  const { busy, error, run } = useAuthSubmit(onSubmit && (() => onSubmit({ email: email.trim() })))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const bad = isEmail(email) ? undefined : 'Enter the email you signed up with.'
    setFieldError(bad)
    if (!bad && (await run())) setSent(true)
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        below={
          <>
            Remembered it? <AuthLink href={signInHref}>Back to sign in</AuthLink>
          </>
        }
      >
        <div role="status" className="space-y-4 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-green-500/10 text-green-700 dark:text-green-400" aria-hidden="true">
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-400">
            If <span className="font-medium text-foreground">{email.trim()}</span> has an account, a link to reset the password is on its way.
          </p>
          <button type="button" onClick={() => setSent(false)} className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Use a different email
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we will send you a link to set a new one."
      below={
        <>
          Remembered it? <AuthLink href={signInHref}>Back to sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="Email" error={fieldError}>
          <TextInput type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel="Sending the link">
          Send reset link
        </SubmitButton>
      </form>
    </AuthShell>
  )
}

export default ForgotPasswordPage
