import { cn } from '@/lib/utils'
import { Card, CardMedia } from '@/components/ui/card'

/**
 * A poster-only card (chaicode.com's events page): the image carries the
 * whole design, so the card is just the warm hairline round it and the 3%
 * zoom on hover. `alt` must say what the poster says. Lay them out two per
 * row (CardGrid columns={2}).
 */
export function EventCard({ href, image, alt, className }: { href: string; image: string; alt: string; className?: string }) {
  return (
    <Card className={cn('h-full w-full', className)}>
      <a href={href} className="block outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
        <CardMedia>
          <img src={image} alt={alt} loading="lazy" />
        </CardMedia>
      </a>
    </Card>
  )
}
