'use client'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * Overlapping avatars for "who else is here": instructors, people in a
 * cohort. Beyond `max` the rest collapse into a "+N". Each face keeps its
 * name for screen readers.
 */
function AvatarGroup({
  people,
  max = 4,
  size = 'md',
  className,
}: {
  people: { name: string; src?: string }[]
  max?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  const box = size === 'sm' ? 'size-7 text-[10px]' : 'size-9 text-xs'
  return (
    <div data-slot="avatar-group" className={cn('flex items-center -space-x-2', className)}>
      {shown.map((p) => (
        <Avatar key={p.name} className={cn(box, 'ring-2 ring-background')}>
          {p.src && <AvatarImage src={p.src} alt={p.name} />}
          <AvatarFallback>
            <span aria-hidden="true">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
            <span className="sr-only">{p.name}</span>
          </AvatarFallback>
        </Avatar>
      ))}
      {rest > 0 && (
        <span className={cn(box, 'relative grid place-items-center rounded-full bg-muted font-montserrat font-semibold text-muted-foreground ring-2 ring-background')}>
          +{rest}
          <span className="sr-only"> more</span>
        </span>
      )}
    </div>
  )
}

export { AvatarGroup }
