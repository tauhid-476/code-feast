'use client'

import * as React from 'react'

import { Highlight } from '@/components/ui/highlight'
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

const MIN_PASSWORD = 8

/**
 * Create an account: name, email and a password of at least eight
 * characters, or Google and GitHub. Wire `onSubmit` to your auth provider;
 * return a message such as "That email already has an account" to show it.
 */
export function SignUpPage({
  onSubmit,
  onOAuth,
  providers = ['google', 'github'],
  signInHref = '/sign-in',
  termsHref = '/terms-of-service',
  privacyHref = '/privacy-policy',
}: {
  onSubmit?: (values: { name: string; email: string; password: string }) => SubmitResult
  onOAuth?: (provider: OAuthProvider) => void
  providers?: OAuthProvider[]
  signInHref?: string
  termsHref?: string
  privacyHref?: string
}) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [errors, setErrors] = React.useState<{ name?: string; email?: string; password?: string }>({})
  const { busy, error, run, fail } = useAuthSubmit(onSubmit && (() => onSubmit({ name: name.trim(), email: email.trim(), password })))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = {
      name: name.trim() ? undefined : 'Tell us what to call you.',
      email: isEmail(email) ? undefined : 'Enter an email you can open.',
      password: password.length >= MIN_PASSWORD ? undefined : `Use at least ${MIN_PASSWORD} characters.`,
    }
    setErrors(next)
    if (!next.name && !next.email && !next.password) void run()
  }

  return (
    <AuthShell
      title="Create your account"
      description={
        <>
          Join a community that <Highlight>learns together and finishes</Highlight>.
        </>
      }
      below={
        <>
          Already have an account? <AuthLink href={signInHref}>Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <OAuthButtons providers={providers} onSelect={oauthHandler(onOAuth, fail)} />
        <Field label="Name" error={errors.name}>
          <TextInput autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <TextInput type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password" error={errors.password} hint={`At least ${MIN_PASSWORD} characters.`}>
          <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel="Creating your account">
          Create account
        </SubmitButton>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to the <AuthLink href={termsHref} className="font-normal">terms of service</AuthLink> and the{' '}
          <AuthLink href={privacyHref} className="font-normal">privacy policy</AuthLink>.
        </p>
      </form>
    </AuthShell>
  )
}

export default SignUpPage
