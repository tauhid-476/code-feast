'use client'

import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useRef } from 'react'

import { cn } from '@/lib/utils'

/**
 * A highlight that sweeps across grey text (ui/shiny-text.tsx). The only
 * gradient text the system allows: use it once per page at most, on a short
 * line. With reduced motion it is plain grey text.
 */
export function ShinyText({
  children,
  speed = 2,
  delay = 0,
  className,
}: {
  children: string
  /** Seconds for one sweep. */
  speed?: number
  /** Seconds to rest between sweeps. */
  delay?: number
  className?: string
}) {
  const still = useReducedMotion() ?? false
  const progress = useMotionValue(0)
  const elapsed = useRef(0)
  const last = useRef<number | null>(null)

  useAnimationFrame((time) => {
    if (still) return
    if (last.current === null) {
      last.current = time
      return
    }
    elapsed.current += time - last.current
    last.current = time
    const sweep = speed * 1000
    const t = elapsed.current % (sweep + delay * 1000)
    progress.set(t < sweep ? (t / sweep) * 100 : 100)
  })

  // 0 puts the shine off the right edge, 100 off the left.
  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`)

  return (
    <motion.span
      className={cn(
        'inline-block bg-size-[200%_auto] bg-clip-text text-transparent [--shine:#171717] [--shiny-base:#71717a] dark:[--shine:#ffffff] dark:[--shiny-base:#b5b5b5]',
        'bg-[linear-gradient(120deg,var(--shiny-base)_0%,var(--shiny-base)_35%,var(--shine)_50%,var(--shiny-base)_65%,var(--shiny-base)_100%)]',
        className,
      )}
      style={still ? undefined : { backgroundPosition }}
    >
      {children}
    </motion.span>
  )
}
