'use client'

import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Content that opens below a trigger, by click or, with `openOnHover`, on
 * hover too (chaicode.com's testimonial captions, ui/disclosure.tsx). The
 * height eases open; reduced motion makes it instant.
 */
type Ctx = { open: boolean; setOpen: (open: boolean) => void; contentId: string }
const DisclosureContext = React.createContext<Ctx | null>(null)

function useDisclosure() {
  const ctx = React.use(DisclosureContext)
  if (!ctx) throw new Error('Disclosure parts must be inside <Disclosure>')
  return ctx
}

export function Disclosure({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  openOnHover = false,
  className,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Also open while the pointer is over the whole block. Clicks still toggle. */
  openOnHover?: boolean
  className?: string
  children: React.ReactNode
}) {
  const [inner, setInner] = React.useState(defaultOpen)
  const open = openProp ?? inner
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInner(next)
      onOpenChange?.(next)
    },
    [openProp, onOpenChange],
  )
  const contentId = React.useId()
  return (
    <DisclosureContext value={{ open, setOpen, contentId }}>
      <div
        className={className}
        onPointerEnter={openOnHover ? (e) => e.pointerType === 'mouse' && setOpen(true) : undefined}
        onPointerLeave={openOnHover ? (e) => e.pointerType === 'mouse' && setOpen(false) : undefined}
      >
        {children}
      </div>
    </DisclosureContext>
  )
}

/** A button that toggles the content. Pass `asChild` to use your own <button>. */
export function DisclosureTrigger({ asChild = false, className, onClick, ...props }: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const { open, setOpen, contentId } = useDisclosure()
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : 'button'}
      aria-expanded={open}
      aria-controls={contentId}
      className={cn('cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(e)
        if (!e.defaultPrevented) setOpen(!open)
      }}
      {...props}
    />
  )
}

export function DisclosureContent({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, contentId } = useDisclosure()
  return (
    <div id={contentId} className={cn('overflow-hidden', className)}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
