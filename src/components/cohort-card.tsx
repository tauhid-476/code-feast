'use client'

import '@fontsource/anton'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { LiveDot } from '@/components/ui/live-dot'
import { TiltCard, TiltCardBody, TiltCardItem } from '@/components/tilt-card'

/**
 * chaicode.com's cohort card (cards/card-design-1 to 4): a tilt card with a
 * film-grain texture, the status in the corner, the name in Anton, and the
 * cohort's tools orbiting a centre logo over 12s, counter-rotated so they
 * stay upright. The orbit holds still for reduced motion. The whole card is
 * one link.
 */
export function CohortCard({
  name,
  href,
  status = 'live',
  center,
  orbit = [],
  footer,
  className,
}: {
  name: string
  href: string
  status?: 'live' | 'recorded'
  /** The logo in the middle. */
  center: React.ReactNode
  /** Up to four tool icons that circle it. */
  orbit?: React.ReactNode[]
  /** A line at the bottom, e.g. instructors or the start date. */
  footer?: React.ReactNode
  className?: string
}) {
  const spots = ['-translate-y-17', 'translate-x-17', 'translate-y-17', '-translate-x-17']
  return (
    <a href={href} className={cn('block w-fit rounded-xl outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}>
      <TiltCard>
        <TiltCardBody className="group/card relative h-[400px] w-[290px] p-0 sm:w-[300px]">
          <Grain />
          <TiltCardItem translateZ={20} className="absolute top-4 right-4">
            {status === 'live' ? (
              <LiveDot className="p-3">Live</LiveDot>
            ) : (
              <span className="flex items-center gap-1.5 p-3 font-montserrat text-xs font-medium">
                <span className="size-1.5 rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true" />
                Recorded
              </span>
            )}
          </TiltCardItem>

          <TiltCardItem translateZ={25} className="absolute top-12 w-full px-6 text-center">
            <p className="font-[Anton] text-3xl text-orange-950 sm:text-4xl dark:text-orange-100">{name}</p>
          </TiltCardItem>

          <TiltCardItem translateZ={50} className="flex size-full items-center justify-center overflow-hidden">
            <div className="flex size-full items-center justify-center [mask-image:radial-gradient(70%_50%_at_center,white,transparent)]" aria-hidden="true">
              <div className="relative mt-8 flex items-center justify-center">
                <Orb className="relative z-10 size-30 [&_svg]:size-15">{center}</Orb>
                <div className="absolute inset-0 flex items-center justify-center motion-safe:animate-[spin_12s_linear_infinite]">
                  {orbit.slice(0, 4).map((icon, i) => (
                    <Orb
                      key={i}
                      className={cn(
                        'absolute size-14 transition-transform duration-300 [&_svg]:size-7 motion-safe:animate-[spin_12s_linear_infinite_reverse]',
                        spots[i],
                      )}
                    >
                      {icon}
                    </Orb>
                  ))}
                </div>
              </div>
            </div>
          </TiltCardItem>

          {footer && (
            <TiltCardItem translateZ={20} className="absolute bottom-4 px-6 pb-3 font-mono text-sm">
              {footer}
            </TiltCardItem>
          )}
        </TiltCardBody>
      </TiltCard>
    </a>
  )
}

function Orb({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full border border-neutral-400/25 bg-[rgba(248,248,248,0.01)] shadow-[inset_0_0_8px_0_rgba(248,248,248,0.25)] dark:border-0',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Film grain from an SVG filter, so there is no image to ship. */
function Grain() {
  const id = React.useId()
  return (
    <svg className="pointer-events-none absolute inset-0 size-full rounded-xl opacity-25 invert dark:opacity-60 dark:invert-0" aria-hidden="true">
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="1.34" numOctaves="4" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="linear" slope=".46" />
          <feFuncG type="linear" slope=".46" />
          <feFuncB type="linear" slope=".46" />
          <feFuncA type="linear" slope=".56" />
        </feComponentTransfer>
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.47" intercept="-.23" />
          <feFuncG type="linear" slope="1.47" intercept="-.23" />
          <feFuncB type="linear" slope="1.47" intercept="-.23" />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  )
}
