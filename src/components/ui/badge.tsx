import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The small labels that sit on a card's image, with the exact colours from
 * chaicode.com's udemy cards. They belong on top of media only; everywhere
 * else, status is text colour (see Chip and Level).
 *
 * - `overlay`: a frosted black pill, for the rating ("4.7 ★").
 * - `new`: teal, for "New" and "Bestseller".
 * - `hot`: rose, for "Hot & New".
 * - `rated`: wheat, for "Highest Rated".
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] leading-4 font-bold tracking-wide whitespace-nowrap [&>svg]:size-3',
  {
    variants: {
      variant: {
        overlay: 'bg-black/70 text-xs font-medium tracking-normal text-white backdrop-blur-md',
        new: 'bg-[#c8ebe8] text-[#1a5c5c]',
        hot: 'bg-[#f8d4d4] text-[#9b1c1c]',
        rated: 'bg-[oklch(0.9232_0.0692_78.84)] text-[oklch(46.68%_0.1161_51.53)]',
      },
    },
    defaultVariants: { variant: 'overlay' },
  },
)

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
