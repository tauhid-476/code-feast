'use client'

import { Check, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'

/**
 * LinkedIn, X, WhatsApp and copy link, with a line already written (Chai
 * Prep's ShareButtons). `path` is site-relative and the origin comes from
 * the page, so it works on localhost, previews and production alike. Every
 * shared link carries `?via=share`, so you can tell visits from a post apart.
 * Where the device has a share sheet, a "More" button opens it.
 */
export function ShareButtons({ path, text, compact = false, className }: { path: string; text: string; compact?: boolean; className?: string }) {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const [native, setNative] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
    setNative(typeof navigator.share === 'function')
  }, [])

  const url = `${origin}${path}${path.includes('?') ? '&' : '?'}via=share`
  const enc = encodeURIComponent
  const targets = [
    { label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, icon: <LinkedIn /> },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`, icon: <XLogo /> },
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}`, icon: <WhatsApp /> },
  ]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the share links still work.
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center', compact ? 'gap-1.5' : 'gap-2', className)}>
      {targets.map((t) => (
        // A styled anchor rather than Button with asChild: the shadcn CLI rewrites asChild
        // into Base UI's render prop in apps on a base-* style.
        <a
          key={t.label}
          href={t.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`Share on ${t.label}`}
          className={buttonVariants({ variant: 'muted', size: compact ? 'icon' : 'sm' })}
        >
          {t.icon}
          {!compact && t.label}
        </a>
      ))}
      <Button variant="muted" size="sm" onClick={copy} aria-live="polite">
        {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        {copied ? 'Link copied' : 'Copy link'}
      </Button>
      {native && !compact && (
        <Button variant="ghost" size="sm" onClick={() => void navigator.share({ title: text, text, url }).catch(() => {})}>
          More
        </Button>
      )}
    </div>
  )
}

function LinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3.5">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.83v1.54h.06c.53-1 1.84-2.06 3.79-2.06 4.05 0 4.8 2.67 4.8 6.13V21h-4v-5.02c0-1.2-.02-2.74-1.67-2.74-1.67 0-1.93 1.3-1.93 2.65V21h-4V9.75Z" />
    </svg>
  )
}

function XLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3.5">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  )
}

function WhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3.5">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.46 9.48-9.46a9.4 9.4 0 0 1 6.69 2.78 9.4 9.4 0 0 1 2.77 6.69c0 5.22-4.25 9.46-9.46 9.46Zm8.05-17.51A11.32 11.32 0 0 0 12.04.66C5.77.66.66 5.76.66 12.04c0 2 .52 3.96 1.52 5.69L.57 23.6l6.02-1.58a11.36 11.36 0 0 0 5.44 1.39h.01c6.27 0 11.38-5.1 11.38-11.38 0-3.04-1.18-5.9-3.33-8.05Z" />
    </svg>
  )
}
