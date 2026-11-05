'use client'

import { Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Backdrop } from '@/components/backdrop'
import { Logo } from '@/components/logo'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * The pieces every auth page is made of. The page is quiet on purpose: the
 * background, the logo, one warm hairline card in the middle and nothing
 * else to look at. The submit button is the one solid button on the screen.
 *
 * Nothing here talks to a server. Each page takes an `onSubmit` that you
 * point at your auth provider; return a message to show it as an error.
 */
export type OAuthProvider = 'google' | 'github'

/** Returns nothing on success, or a message to show the person. */
export type SubmitResult = void | string | null | undefined
export type SubmitHandlerResult = SubmitResult | Promise<SubmitResult>

export function AuthShell({
  title,
  description,
  children,
  below,
  homeHref = '/',
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  /** Under the card, e.g. "New here? Create an account". */
  below?: React.ReactNode
  homeHref?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Backdrop />
      <header className="flex items-center justify-between px-6 py-5 sm:px-12">
        <Link href={homeHref} aria-label="Home" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <ThemeSwitcher />
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pt-8 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h1>
            {description && <p className="mt-2 text-sm text-neutral-700 sm:text-base dark:text-neutral-400">{description}</p>}
          </div>
          <div className="card-chai p-6 sm:p-8">{children}</div>
          {below && <p className="mt-6 text-center text-sm text-muted-foreground">{below}</p>}
        </div>
      </main>

      <footer className="px-6 py-6 text-center font-montserrat text-[13px] text-gray-500">© {new Date().getFullYear()} CodeFeast. All rights reserved.</footer>
    </div>
  )
}

/** A text link in auth copy: quiet until hovered, then the brand colour. */
export function AuthLink({ className, href, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      className={cn('font-medium text-foreground underline-offset-4 transition-colors duration-200 hover:text-brand hover:underline focus-visible:underline', className)}
      {...props}
    />
  )
}

/** The shared Field, re-exported so the auth pages import from one place. */
export { Field }

export function TextInput(props: React.ComponentProps<'input'>) {
  return <Input {...props} className={cn('h-10', props.className)} />
}

/** A password box with a show and hide toggle. */
export function PasswordInput(props: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [shown, setShown] = React.useState(false)
  return (
    <div className="relative">
      <Input {...props} type={shown ? 'text' : 'password'} className={cn('h-10 pr-10', props.className)} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

/** The one solid button on the page. Shows `busyLabel` while the request runs. */
export function SubmitButton({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="solid" size="lg" iconRight={null} className="w-full" disabled={busy} aria-busy={busy || undefined}>
      {busy ? busyLabel : children}
    </Button>
  )
}

/** The form-level error, announced when it appears. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-700 dark:text-red-400">
      {message}
    </p>
  )
}

const providerMeta: Record<OAuthProvider, { label: string; icon: React.ReactNode }> = {
  google: {
    label: 'Google',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.27a12 12 0 0 0 0 10.76l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.87 8.87 4.76 12 4.76Z" />
      </svg>
    ),
  },
  github: {
    label: 'GitHub',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-4">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
}

/**
 * Sign in with Google or GitHub, in the toolbar field's boxed style so they
 * stay quieter than the solid submit button.
 */
export function OAuthButtons({ providers, onSelect, verb = 'Continue' }: { providers: OAuthProvider[]; onSelect: (p: OAuthProvider) => void; verb?: string }) {
  if (!providers.length) return null
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {providers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-200 bg-white text-sm font-medium transition-colors duration-150 outline-none hover:bg-gray-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-gray-800 dark:bg-black/50 dark:hover:bg-gray-900"
          >
            {providerMeta[p].icon}
            {verb} with {providerMeta[p].label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or with email
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}

/** Hands a provider to `onOAuth`, or explains that it is not wired yet. */
export function oauthHandler(onOAuth: ((p: OAuthProvider) => void) | undefined, fail: (m: string) => void) {
  return (p: OAuthProvider) =>
    onOAuth ? onOAuth(p) : fail(`Signing in with ${providerMeta[p].label} is not connected yet. Pass onOAuth to wire it.`)
}

/**
 * Runs a submit handler with a busy flag and a form-level error. Without a
 * handler it says so, rather than pretending to sign anyone in.
 */
export function useAuthSubmit(handler?: () => SubmitHandlerResult) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const run = async () => {
    setError(null)
    if (!handler) {
      setError('This form is not connected yet. Pass onSubmit to wire it to your auth provider.')
      return false
    }
    setBusy(true)
    try {
      const message = await handler()
      if (message) {
        setError(message)
        return false
      }
      return true
    } catch {
      setError('Something went wrong. Please try again.')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run, fail: setError }
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
