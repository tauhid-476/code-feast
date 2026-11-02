'use client'

import { useReducedMotion } from 'motion/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The 3D tilt card behind chaicode.com's cohort cards (ui/3d-card.tsx). The
 * card turns toward the pointer by its offset over 25 degrees, and each
 * TiltCardItem rises by its own `translateZ` while the pointer is over it.
 * Depth comes from the tilt, never from a drop shadow. Nothing moves for
 * people who ask for reduced motion.
 */
const HoverContext = React.createContext(false)

export function TiltCard({ children, className, containerClassName }: { children: React.ReactNode; className?: string; containerClassName?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [hover, setHover] = React.useState(false)
  const still = useReducedMotion() ?? false

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (still || !ref.current) return
    const { left, top, width, height } = ref.current.getBoundingClientRect()
    const x = (e.clientX - left - width / 2) / 25
    const y = (e.clientY - top - height / 2) / 25
    ref.current.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`
  }
  const onLeave = () => {
    setHover(false)
    if (ref.current) ref.current.style.transform = 'rotateY(0deg) rotateX(0deg)'
  }

  return (
    <HoverContext value={hover && !still}>
      <div className={cn('flex items-center justify-center', containerClassName)} style={{ perspective: '1000px' }}>
        <div
          ref={ref}
          onPointerEnter={() => setHover(true)}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className={cn('relative flex items-center justify-center transition-transform duration-200 ease-linear', className)}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {children}
        </div>
      </div>
    </HoverContext>
  )
}

export function TiltCardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-black/10 bg-white p-6 [transform-style:preserve-3d] dark:border-white/15 dark:bg-[#111] [&>*]:[transform-style:preserve-3d]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function TiltCardItem({
  as: Tag = 'div',
  translateZ = 0,
  className,
  children,
  ...props
}: {
  as?: React.ElementType
  /** How far it rises toward the viewer on hover, in px. chaicode uses 10 to 50. */
  translateZ?: number
  className?: string
  children?: React.ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  const hover = React.use(HoverContext)
  return (
    <Tag
      className={cn('w-fit transition-transform duration-200 ease-linear', className)}
      style={{ transform: hover ? `translateZ(${translateZ}px)` : 'translateZ(0px)' }}
      {...props}
    >
      {children}
    </Tag>
  )
}
