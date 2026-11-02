import * as React from 'react'

import { cn } from '@/lib/utils'

const tones = {
  Easy: 'text-green-700 dark:text-green-400',
  Medium: 'text-yellow-700 dark:text-yellow-400',
  Hard: 'text-red-700 dark:text-red-400',
} as const

/** Easy / Medium / Hard as a small coloured word with a dot, the way Chai Prep's cards carry it. */
function Level({ level, className, ...props }: React.ComponentProps<'span'> & { level: keyof typeof tones }) {
  return (
    <span
      data-slot="level"
      className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide', tones[level], className)}
      {...props}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {level}
    </span>
  )
}

export { Level }
