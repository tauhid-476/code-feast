'use client'

import * as React from 'react'

import {
  AuthLink,
  AuthShell,
  Field,
  FormError,
  isEmail,
  oauthHandler,
  OAuthButtons,
  PasswordInput,
  SubmitButton,
  TextInput,
  useAuthSubmit,
  type OAuthProvider,
  type SubmitResult,
} from '@/components/auth-shell'

/**
 * Sign in. Wire `onSubmit` and `onOAuth` to your auth provider (Better Auth,
 * Clerk, Supabase, your own API). Return a message from onSubmit to show it,
 * such as "That email and password do not match".
 */
export function SignInPage({
  onSubmit,
  onOAuth,
  providers = ['google', 'github'],
  signUpHref = '/sign-up',
  forgotHref = '/forgot-password',
}: {
  onSubmit?: (values: { email: string; password: string }) => SubmitResult
  onOAuth?: (provider: OAuthProvider) => void
  providers?: OAuthProvider[]
  signUpHref?: string
  forgotHref?: string
}) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({})
  const { busy, error, run, fail } = useAuthSubmit(onSubmit && (() => onSubmit({ email: email.trim(), password })))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = {
      email: isEmail(email) ? undefined : 'Enter the email you signed up with.',
      password: password ? undefined : 'Enter your password.',
    }
    setErrors(next)
    if (!next.email && !next.password) void run()
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to pick up where you left off."
      below={
        <>
          New here? <AuthLink href={signUpHref}>Create an account</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <OAuthButtons providers={providers} onSelect={oauthHandler(onOAuth, fail)} />
        <Field label="Email" error={errors.email}>
          <TextInput type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={errors.password} aside={<AuthLink href={forgotHref} className="font-normal text-muted-foreground">Forgot password?</AuthLink>}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel="Signing in">
          Sign in
        </SubmitButton>
      </form>
    </AuthShell>
  )
}

export default SignInPage
