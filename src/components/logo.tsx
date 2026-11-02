'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * The Code Feast mark: uses /logo.png with an optional text wordmark.
 * Keeps exports and props stable.
 */
export function Logo({
  wordmark = true,
  className,
}: {
  wordmark?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src="/logo.png"
        alt="Code Feast"
        width={42}
        height={28}
        className="h-7 w-auto max-w-[120px] rounded object-contain"
        priority
      />
      {wordmark && (
        <span className="font-semibold text-base tracking-tight text-foreground">
          Code Feast
        </span>
      )}
    </span>
  )
}
