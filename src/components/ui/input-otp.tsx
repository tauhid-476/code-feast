'use client'

import { OTPInput, OTPInputContext } from 'input-otp'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A one-time code, one box per digit, for email verification and two-step
 * sign in. Built on input-otp: paste fills every box, the phone offers the
 * code from SMS, and it is one real input underneath for screen readers.
 */
function InputOTP({ className, containerClassName, ...props }: React.ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="input-otp"
      autoComplete="one-time-code"
      containerClassName={cn('flex items-center gap-2 has-disabled:opacity-50', containerClassName)}
      className={cn('disabled:cursor-not-allowed', className)}
      {...props}
    />
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="input-otp-group" className={cn('flex items-center gap-2', className)} {...props} />
}

function InputOTPSlot({ index, className }: { index: number; className?: string }) {
  const ctx = React.use(OTPInputContext)
  const { char, hasFakeCaret, isActive } = ctx?.slots[index] ?? {}
  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        'relative flex size-11 items-center justify-center rounded-md border border-gray-200 bg-white font-mono text-lg tabular-nums transition-colors dark:border-gray-800 dark:bg-black/50',
        'data-[active=true]:border-gray-400 data-[active=true]:ring-[3px] data-[active=true]:ring-ring/30 dark:data-[active=true]:border-gray-600',
        className,
      )}
    >
      {char}
      {hasFakeCaret && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="h-5 w-px bg-foreground motion-safe:animate-pulse" />
        </span>
      )}
    </div>
  )
}

function InputOTPSeparator() {
  return (
    <span role="separator" className="text-muted-foreground" aria-hidden="true">
      -
    </span>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
