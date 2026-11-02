import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * The instructor block (cards/instructor-card.tsx): name in Onest, a short
 * bio with one highlighted phrase, round social links, and a portrait on the
 * right that fades into the page at the bottom. Optional stats under the bio.
 */
export function Instructor({
  name,
  role,
  children,
  photo,
  photoAlt,
  socials = [],
  stats,
  className,
}: {
  name: string
  role?: string
  /** The bio. One <Highlight> in it. */
  children: React.ReactNode
  photo: string
  photoAlt: string
  socials?: { label: string; href: string; icon: React.ReactNode }[]
  stats?: { value: string; label: string }[]
  className?: string
}) {
  return (
    <section className={cn('flex w-full max-w-4xl flex-col-reverse gap-8 md:flex-row md:items-end lg:gap-12', className)}>
      <div className="space-y-6 md:flex-1 md:pb-8">
        <div>
          {role && <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">{role}</p>}
          <h2 className="font-onest text-3xl font-medium tracking-tight text-gray-900 lg:text-4xl dark:text-white">{name}</h2>
        </div>
        <p className="text-base leading-relaxed text-gray-700 lg:text-lg dark:text-gray-300">{children}</p>
        {stats && (
          <dl className="flex gap-8">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="text-xs text-gray-500 dark:text-gray-400">{s.label}</dt>
                <dd className="font-montserrat text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {socials.length > 0 && (
          <ul className="flex items-center gap-4">
            {socials.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex size-10 items-center justify-center rounded-full bg-neutral-50 text-neutral-700 transition-colors outline-none hover:bg-transparent hover:text-brand focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-transparent [&_svg]:size-4"
                >
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="relative mx-auto w-64 shrink-0 overflow-hidden rounded-xl md:mx-0 md:w-80">
        <img src={photo} alt={photoAlt} className="aspect-[4/5] w-full object-cover [mask-image:linear-gradient(to_bottom,#000_65%,transparent)]" loading="lazy" />
      </div>
    </section>
  )
}
