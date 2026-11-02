import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

export type Feature = {
  title: string
  description: string
  link?: { label: string; href: string }
  /** The tint of the title badge, from chaicode.com's palette. */
  tone?: 'blue' | 'purple' | 'amber' | 'grey'
}

const tones = {
  blue: 'bg-[#006FEE33] text-[#005bc4] dark:text-[#66aaf9]',
  purple: 'bg-[#7828c833] text-[#6020a0] dark:bg-[#9353d333] dark:text-[#ae7ede]',
  amber: 'bg-[#f5a52433] text-[#c4841d] dark:text-[#f9c97c]',
  grey: 'bg-[#d4d4d866] text-[#52525b] dark:bg-[#71717a33] dark:text-[#d4d4d8]',
}

/**
 * The "Why ChaiCode" grid (landing/features.tsx): three cells over four,
 * square inside with rounded outer corners, frosted, each led by a tinted
 * title badge. Pass seven features; the first three take the top row.
 */
export function FeatureBento({ features, className }: { features: Feature[]; className?: string }) {
  const top = features.slice(0, 3)
  const bottom = features.slice(3)
  return (
    <div className={cn('mt-8', className)}>
      <div className="grid md:grid-cols-3">
        {top.map((f, i) => (
          <Cell key={f.title} feature={f} className={cn(i === 0 && 'rounded-tl-lg max-md:rounded-tr-lg', i === top.length - 1 && 'md:rounded-tr-lg')} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        {bottom.map((f, i) => (
          <Cell
            key={f.title}
            feature={f}
            className={cn(i === 0 && 'md:rounded-bl-lg', i === bottom.length - 1 && 'rounded-br-lg max-sm:rounded-bl-lg')}
          />
        ))}
      </div>
    </div>
  )
}

function Cell({ feature, className }: { feature: Feature; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 border border-border bg-white/70 px-8 py-10 backdrop-blur-2xl transition-colors duration-300 hover:border-accent-foreground/30 hover:bg-white md:py-12 dark:bg-black/10 dark:hover:bg-accent/20',
        className,
      )}
    >
      <span className={cn('w-fit rounded-sm px-2 py-0.5 font-montserrat text-lg font-medium', tones[feature.tone ?? 'grey'])}>{feature.title}</span>
      <p className="flex-1 text-lg font-medium">{feature.description}</p>
      {feature.link && (
        <a
          href={feature.link.href}
          className="flex w-fit items-center text-xs font-medium text-muted-foreground transition-all duration-300 hover:gap-0.5 hover:text-foreground"
        >
          {feature.link.label}
          <ArrowRight className="size-4" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}
