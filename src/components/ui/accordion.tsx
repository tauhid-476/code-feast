'use client'

import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Plus } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * chaicode.com's FAQ (cohorts/faq.tsx): each question is its own rounded
 * frosted pill in Montserrat, and the answer eases open under it. Radix
 * gives it keyboard and screen-reader support. No shadow, unlike the
 * original. The height animation is skipped for reduced motion.
 */
function Accordion({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" className={cn('grid w-full gap-3', className)} {...props} />
}

function AccordionItem({ className, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('overflow-hidden rounded-3xl border border-neutral-500/5 bg-black/5 backdrop-blur-lg dark:border-neutral-400/10 dark:bg-white/5', className)}
      {...props}
    />
  )
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group flex min-h-14 flex-1 cursor-pointer items-center gap-3 px-5 py-3 text-left font-montserrat font-medium tracking-[-0.022em] outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-6',
          className,
        )}
        {...props}
      >
        <span className="flex-1">{children}</span>
        <Plus className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-45" aria-hidden="true" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden motion-safe:data-[state=closed]:animate-chai-accordion-up motion-safe:data-[state=open]:animate-chai-accordion-down"
      {...props}
    >
      <div className={cn('px-5 pb-5 leading-relaxed tracking-[-0.022em] text-neutral-700 sm:px-6 dark:text-neutral-300', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
