import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardMedia } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'

export type Course = {
  title: string
  href: string
  image: string
  description?: string
  instructors?: string
  /** The label on the image, and its colour. */
  badge?: { label: string; variant: 'new' | 'hot' | 'rated' }
  rating?: number
  chips?: string[]
  /** As shown, with the currency: "₹499". */
  price?: string
  originalPrice?: string
  action?: string
}

const amount = (s?: string) => Number.parseFloat(s?.replace(/[^0-9.]/g, '') || '0')

/**
 * The course card from chaicode.com's udemy page: image with a badge and the
 * rating, Montserrat title, two-line description, instructors, outlined
 * chips, the price with the old one struck through in red and the saving in
 * green, and "View details". `layout="list"` puts the image on the left.
 */
export function CourseCard({ course, layout = 'grid', className }: { course: Course; layout?: 'grid' | 'list'; className?: string }) {
  const list = layout === 'list'
  const now = amount(course.price)
  const was = amount(course.originalPrice)
  const off = was > 0 && now > 0 ? Math.round(((was - now) / was) * 100) : 0

  return (
    <Card className={cn('h-full w-full', list ? 'flex-row' : 'flex-col', className)}>
      <a
        href={course.href}
        tabIndex={-1}
        aria-hidden="true"
        className={cn(list ? 'relative w-[36%] max-w-40 shrink-0 self-stretch sm:w-[40%] sm:max-w-none md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]' : 'block')}
      >
        <CardMedia className={list ? 'h-full' : undefined}>
          <img src={course.image} alt="" loading="lazy" />
          {course.badge && (
            <Badge variant={course.badge.variant} className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2">
              {course.badge.label}
            </Badge>
          )}
          {course.rating != null && (
            <Badge className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2">
              {course.rating}
              <Star className="fill-yellow-400 text-yellow-400" aria-hidden="true" />
            </Badge>
          )}
        </CardMedia>
      </a>

      <div className={cn('flex min-w-0 flex-1 flex-col justify-between', list ? 'p-2.5 sm:px-4 sm:py-3' : 'p-3 pt-2')}>
        <a href={course.href} className="space-y-1 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:space-y-1.5">
          <h3 className={cn('font-montserrat leading-snug font-semibold text-gray-900 dark:text-gray-50', list ? 'line-clamp-2 text-sm sm:line-clamp-none sm:text-lg' : 'text-base')}>
            {course.title}
            {course.rating != null && <span className="sr-only">, rated {course.rating} out of 5</span>}
          </h3>
          {course.description && (
            <p className={cn('text-gray-600 dark:text-gray-400', list ? 'line-clamp-2 text-[11px] leading-relaxed sm:line-clamp-3 sm:text-sm' : 'line-clamp-2 text-xs leading-relaxed')}>
              {course.description}
            </p>
          )}
          {course.instructors && <p className={cn('text-xs text-gray-500', list && 'hidden sm:block')}>{course.instructors}</p>}
        </a>

        {course.chips && course.chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {course.chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {course.price ? (
            <p className="min-w-0 font-montserrat">
              <span className="text-lg font-semibold">{course.price}</span>{' '}
              {course.originalPrice && (
                <>
                  <span className="sr-only">, was </span>
                  <s className="text-xs text-red-600 dark:text-red-400">{course.originalPrice}</s>
                </>
              )}
              {off > 0 && <span className="ml-1.5 text-xs font-medium whitespace-nowrap text-green-700 dark:text-green-400">{off}% off</span>}
            </p>
          ) : (
            <span />
          )}
          <a href={course.href} className={cn(buttonVariants({ size: 'sm' }), 'min-w-24 shrink-0')}>
            {course.action ?? 'View details'}
          </a>
        </div>
      </div>
    </Card>
  )
}
