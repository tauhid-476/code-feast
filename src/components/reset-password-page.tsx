'use client'

import { CheckCircle2, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { authClient } from '@/lib/auth/client'
import { Button } from '@/components/ui/button'
import {
  AuthLink,
  AuthShell,
  Field,
  FormError,
  PasswordInput,
  SubmitButton,
  useAuthSubmit,
  type SubmitHandlerResult,
  type SubmitResult,
} from '@/components/auth-shell'

const MIN_PASSWORD = 8

/**
 * Set a new password using the verification token sent via email.
 */
export function ResetPasswordPage({
  token,
  error: tokenError,
  onSubmit,
  signInHref = '/sign-in',
  forgotHref = '/forgot-password',
}: {
  token?: string | null
  error?: string | null
  onSubmit?: (values: { password: string; token: string }) => SubmitHandlerResult
  signInHref?: string
  forgotHref?: string
}) {
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [errors, setErrors] = React.useState<{ password?: string; confirmPassword?: string }>({})
  const [resetSuccess, setResetSuccess] = React.useState(false)

  const isInvalidToken = Boolean(tokenError || !token)

  const defaultSubmit = React.useCallback(
    async (values: { password: string; token: string }): Promise<SubmitResult> => {
      try {
        const result = await authClient.resetPassword({
          newPassword: values.password,
          token: values.token,
        })
        if (result?.error) {
          return result.error.message ?? 'Failed to reset password. The link may have expired.'
        }
      } catch (err: unknown) {
        return err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      }
    },
    [],
  )

  const activeSubmit = onSubmit ?? defaultSubmit
  const { busy, error, run } = useAuthSubmit(
    () => token ? activeSubmit({ password, token }) : 'Missing reset token.',
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: { password?: string; confirmPassword?: string } = {}

    if (password.length < MIN_PASSWORD) {
      nextErrors.password = `Use at least ${MIN_PASSWORD} characters.`
    }
    if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }

    setErrors(nextErrors)

    if (!nextErrors.password && !nextErrors.confirmPassword) {
      const ok = await run()
      if (ok) {
        setResetSuccess(true)
      }
    }
  }

  if (isInvalidToken) {
    return (
      <AuthShell
        title="Invalid or expired link"
        below={
          <AuthLink href={forgotHref}>Request a new reset link</AuthLink>
        }
      >
        <div role="alert" className="space-y-4 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-500/10 text-red-700 dark:text-red-400" aria-hidden="true">
            <ShieldAlert className="size-6" />
          </span>
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-400">
            This password reset link is invalid or has expired. Please request a new link to reset your password.
          </p>
          <Button asChild variant="solid" size="lg" iconRight={null} className="w-full">
            <Link href={forgotHref}>Request new reset link</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (resetSuccess) {
    return (
      <AuthShell
        title="Password updated"
        below={
          <AuthLink href={signInHref}>Proceed to sign in</AuthLink>
        }
      >
        <div role="status" className="space-y-4 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-green-500/10 text-green-700 dark:text-green-400" aria-hidden="true">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-400">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Button asChild variant="solid" size="lg" iconRight={null} className="w-full">
            <Link href={signInHref}>Sign in</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set new password"
      description="Enter your new password below to regain access to your account."
      below={
        <>
          Remembered it? <AuthLink href={signInHref}>Back to sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <Field label="New password" error={errors.password} hint={`At least ${MIN_PASSWORD} characters.`}>
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword}>
          <PasswordInput
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Field>
        <FormError message={error} />
        <SubmitButton busy={busy} busyLabel="Resetting password">
          Reset password
        </SubmitButton>
      </form>
    </AuthShell>
  )
}

export default ResetPasswordPage
