'use client'

import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'

/**
 * The landing-page carousel (landing/cohorts.tsx, landing/udemy.tsx): Embla,
 * autoplay every 3s that stops on hover and never runs for reduced motion,
 * edges that fade out, arrow keys when focused, and the round amber-tinted
 * arrow buttons. Give every child a fixed width (w-[290px] shrink-0).
 */
export function Carousel({
  children,
  label,
  autoplay = true,
  arrows = true,
  className,
}: {
  children: React.ReactNode
  /** Names the region for screen readers. */
  label: string
  autoplay?: boolean
  arrows?: boolean
  className?: string
}) {
  const plugin = React.useRef(Autoplay({ delay: 3000, stopOnMouseEnter: true, stopOnInteraction: false, playOnInit: false }))
  const [ref, api] = useEmblaCarousel({ loop: false, align: 'start', containScroll: 'trimSnaps' }, autoplay ? [plugin.current] : [])
  const [canPrev, setCanPrev] = React.useState(false)
  const [canNext, setCanNext] = React.useState(false)

  React.useEffect(() => {
    if (!api) return
    if (autoplay && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) plugin.current.play()
    const update = () => {
      setCanPrev(api.canScrollPrev())
      setCanNext(api.canScrollNext())
    }
    update()
    api.on('select', update).on('reInit', update)
    return () => {
      api.off('select', update).off('reInit', update)
    }
  }, [api, autoplay])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') api?.scrollNext()
    if (e.key === 'ArrowLeft') api?.scrollPrev()
  }

  return (
    <section aria-label={label} aria-roledescription="carousel" className={className}>
      <div className="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_5%,#000_95%,transparent)]">
        <div ref={ref} tabIndex={0} onKeyDown={onKey} className="rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <div className="flex gap-6 will-change-transform md:gap-12 [&>*]:shrink-0">{children}</div>
        </div>
      </div>
      {arrows && (
        <div className="mt-6 flex justify-end gap-3">
          <ArrowButton label="Previous" disabled={!canPrev} onClick={() => api?.scrollPrev()}>
            <ChevronLeft className="size-5" aria-hidden="true" />
          </ArrowButton>
          <ArrowButton label="Next" disabled={!canNext} onClick={() => api?.scrollNext()}>
            <ChevronRight className="size-5" aria-hidden="true" />
          </ArrowButton>
        </div>
      )}
    </section>
  )
}

function ArrowButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 cursor-pointer items-center justify-center rounded-full border border-gray-300/40 bg-linear-to-br from-gray-50 via-amber-50 to-gray-100/80 text-gray-700 transition-opacity outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-40 dark:border-orange-300/10 dark:from-transparent dark:via-amber-500/5 dark:to-transparent dark:text-white"
    >
      {children}
    </button>
  )
}
