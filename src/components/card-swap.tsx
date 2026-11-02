'use client'

import { motion, useReducedMotion } from 'motion/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A stack of cards set back in 3D; every few seconds the front one drops
 * away and returns at the back (ui/card-swap.tsx, ported from gsap to
 * motion). It pauses while the pointer is over it, and holds still for
 * reduced motion. Decorative: keep anything people must read elsewhere too.
 */
type Slot = { x: number; y: number; z: number; zIndex: number }

const slot = (i: number, distX: number, distY: number, total: number): Slot => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
})

export function CardSwap({
  children,
  width = 420,
  height = 300,
  cardDistance = 60,
  verticalDistance = 70,
  delay = 5000,
  skewAmount = 6,
  pauseOnHover = true,
  className,
}: {
  children: React.ReactNode
  width?: number
  height?: number
  cardDistance?: number
  verticalDistance?: number
  /** Milliseconds between swaps. */
  delay?: number
  skewAmount?: number
  pauseOnHover?: boolean
  className?: string
}) {
  const cards = React.Children.toArray(children)
  const total = cards.length
  const [order, setOrder] = React.useState(() => cards.map((_, i) => i))
  const [dropping, setDropping] = React.useState<number | null>(null)
  const [paused, setPaused] = React.useState(false)
  const still = useReducedMotion() ?? false

  const orderRef = React.useRef(order)
  orderRef.current = order

  React.useEffect(() => {
    if (still || paused || total < 2) return
    let back: number | undefined
    const t = window.setInterval(() => {
      setDropping(orderRef.current[0])
      // Let the front card fall first, then send it to the back.
      back = window.setTimeout(() => {
        setOrder(([front, ...rest]) => [...rest, front])
        setDropping(null)
      }, 500)
    }, delay)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(back)
    }
  }, [still, paused, total, delay])

  return (
    <div
      className={cn('relative', className)}
      style={{ width, height, perspective: '900px' }}
      onPointerEnter={() => pauseOnHover && setPaused(true)}
      onPointerLeave={() => pauseOnHover && setPaused(false)}
    >
      {cards.map((card, i) => {
        const s = slot(order.indexOf(i), cardDistance, verticalDistance, total)
        const isDropping = dropping === i
        return (
          <motion.div
            key={i}
            className="absolute inset-0 [transform-style:preserve-3d] [backface-visibility:hidden]"
            style={{ zIndex: s.zIndex, skewY: skewAmount }}
            initial={false}
            animate={{ x: s.x, y: isDropping ? s.y + 500 : s.y, z: s.z }}
            transition={isDropping ? { duration: 0.6, ease: [0.4, 0, 1, 1] } : { type: 'spring', stiffness: 120, damping: 16, mass: 1 }}
          >
            {card}
          </motion.div>
        )
      })}
    </div>
  )
}

/** One card in the stack: the warm hairline over frosted glass. */
export function CardSwapItem({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('size-full overflow-hidden rounded-xl border border-neutral-300 bg-white/10 backdrop-blur-lg dark:border-neutral-700 dark:bg-black/10', className)}
      {...props}
    />
  )
}
