import * as React from 'react'

import { cn } from '@/lib/utils'

/** The hand-drawn looping arrow from chaicode.com (ui/fancy-arrow.tsx). Decorative, so hidden from screen readers. */
export function FancyArrow({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      width="127"
      height="101"
      viewBox="0 0 127 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('stroke-neutral-900 dark:stroke-neutral-100', className)}
      {...props}
    >
      <path
        d="M1 4.656C25.464-.157 44.325-3.219 63.045 15.501c8.935 8.935 11.105 21.004 4.8 32.355C56.369 68.512 34.619 37.4 50.6 27.412c29.297-18.312 55.395 18.13 59.556 43.555 1.212 7.41.453 7.604.844 15.032.339 6.444 3.187-2.652 4-5 1.215-5-1.872 7.752-.4 3.5 2.092-6.044 4.244-8.435 3.4-4.5-1.6 6.996-3.5 12.796-13.5 3.296-2.037-1.93 10.5-4.8 12.5-5.3 5.775-.68-12.502 7.3-7.1 6.981 7.4-4.5-1.882 7.246-.004-2.741-3.218 1.609-.286-.923-3.5.505-5.296 2.354 5.49.25 6.104-.24 1.785-1.428 5.724 3.4 1 5.5-1.216.54-8.578-5.172-6.964-5.172 5.097 0 13.201-10.578 8.4.822-1.5 3.563.754 5.354-2.436 5.167-1.085-.064-13.844-8.374-2.344-4.917"
        strokeWidth={2}
        strokeLinecap="square"
      />
    </svg>
  )
}
