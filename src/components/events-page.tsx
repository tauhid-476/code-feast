import { CardGrid, ListingHead, Toolbar } from '@/components/listing'
import { EventCard } from '@/components/event-card'
import { Highlight } from '@/components/ui/highlight'
import { PageShell } from '@/components/page-shell'

/**
 * chaicode.com's events page (routes/events/index.tsx): the head, a count
 * with "Past and upcoming", and the posters two to a row. The posters carry
 * the design, so each needs alt text that says what it says.
 */
const EVENTS = [
  { href: '/events/master-aws', image: '/chaiui/demo/event-aws.svg', alt: 'Master AWS, live workshop, 12 October' },
  { href: '/events/langgraph', image: '/chaiui/demo/event-langgraph.svg', alt: 'LangGraph masterclass, 19 October' },
]

export function EventsPage() {
  return (
    <PageShell>
      <ListingHead title="Events and workshops">
        Join our live sessions. <Highlight>Learn directly from the experts</Highlight> and sharpen your skills.
      </ListingHead>
      <Toolbar count={EVENTS.length} noun="events" aside="Past and upcoming" />
      <CardGrid columns={2} className="mt-2">
        {EVENTS.map((e) => (
          <EventCard key={e.href} href={e.href} image={e.image} alt={e.alt} />
        ))}
      </CardGrid>
    </PageShell>
  )
}

export default EventsPage
