import { Bot, Braces, Code2, Database, Server, Smartphone, Sparkles } from 'lucide-react'

import { Carousel } from '@/components/carousel'
import { CohortCard } from '@/components/cohort-card'
import { CtaPanel } from '@/components/cta-panel'
import { FeatureBento, type Feature } from '@/components/feature-bento'
import { Hero } from '@/components/hero'
import { SectionHead } from '@/components/section-head'
import { StatStrip } from '@/components/stat-strip'
import { ReviewCard } from '@/components/testimonials'
import { MediaFrame } from '@/components/media-frame'
import { Highlight } from '@/components/ui/highlight'
import { PageShell } from '@/components/page-shell'

/**
 * A landing page in the chaicode.com order: hero, stats, cohorts, courses,
 * why us, reviews and a closing call to action. Every section is a ChaiUI
 * block; the content is the constants below. Replace them with yours and
 * keep the copy rules: sentence case, no em dashes, one highlight per
 * paragraph, one central element in the hero.
 */
const COHORTS = [
  { name: 'GenAI with Python', href: '/cohorts/genai', center: <Sparkles />, orbit: [<Bot key="a" />, <Code2 key="b" />, <Database key="c" />] },
  { name: 'Web dev', href: '/cohorts/web-dev', center: <Code2 />, orbit: [<Braces key="a" />, <Server key="b" />, <Database key="c" />] },
  { name: 'Mobile dev', href: '/cohorts/mobile-dev', center: <Smartphone />, orbit: [<Code2 key="a" />, <Server key="b" />] },
  { name: 'System design', href: '/cohorts/system-design', center: <Server />, orbit: [<Database key="a" />, <Braces key="b" />, <Bot key="c" />] },
]

const COURSES = [
  { title: 'FastAPI with GenAI', href: '/courses/fastapi', image: '/chaiui/demo/fastapi.svg' },
  { title: 'DevOps from zero', href: '/courses/devops', image: '/chaiui/demo/devops.svg' },
  { title: 'Data structures in Java', href: '/courses/dsa', image: '/chaiui/demo/dsa.svg' },
  { title: 'FastAPI with GenAI', href: '/courses/fastapi-2', image: '/chaiui/demo/fastapi.svg' },
]

const FEATURES: Feature[] = [
  { title: 'You finish it', description: 'Learning together keeps you going to the end.', tone: 'blue', link: { label: 'Cohorts', href: '#cohorts' } },
  { title: 'Real world tasks', description: 'Challenges that mirror what teams expect.', tone: 'purple', link: { label: 'Tasks', href: '/tasks' } },
  { title: 'Peer reviews', description: 'Give and get feedback on real code.', tone: 'amber', link: { label: 'Code reviews', href: '/reviews' } },
  { title: 'Community', description: 'Grow with developers on Discord.', tone: 'grey', link: { label: 'Join us', href: '/discord' } },
  { title: 'Trainings', description: 'Industry experts in class.', tone: 'amber' },
  { title: 'Self learning', description: 'In-depth courses at your own pace.', tone: 'blue', link: { label: 'Courses', href: '/courses' } },
  { title: 'Writing', description: 'Write to show your grip on a stack.', tone: 'purple' },
]

const REVIEWS = [
  { name: 'Arjun Mehta', username: 'arjun_codes', href: 'https://x.com', text: 'The cohort made me ship every week. Six months later I had a portfolio and an offer.' },
  { name: 'Priya Sharma', username: 'priya_builds', href: 'https://x.com', text: 'Peer reviews taught me more than any tutorial. Someone always read my code.' },
  { name: 'Rahul Verma', username: 'rahulv', href: 'https://x.com', text: 'Clear, honest teaching. I finally understood how the pieces of a backend fit.' },
]

export function LandingPage() {
  return (
    <PageShell>
      <Hero
        badge="Trusted by 1.5M+ developers worldwide"
        title="Consistency and community"
        primary={{ label: 'Start learning', href: '#cohorts' }}
        secondary={{ label: 'See the impact', href: '#reviews' }}
        media={<MediaFrame src="/chaiui/demo/fastapi.svg" alt="A ChaiCode course" />}
      >
        Content is everywhere. We provide what is rare, <Highlight>a community-driven learning experience</Highlight>, with peer learning, code
        reviews and an alumni network.
      </Hero>

      <StatStrip
        className="mt-16 sm:mt-20"
        stats={[
          { value: '1.5M+', label: 'Developers' },
          { value: '12', label: 'Cohorts run' },
          { value: '4.8', label: 'Average rating' },
          { value: '600+', label: 'Hours of video' },
        ]}
      />

      <section id="cohorts" aria-labelledby="cohorts-head" className="mt-16 sm:mt-20">
        <SectionHead id="cohorts-head" title="Cohorts">
          Learn in engaging <Highlight>live classes</Highlight>, with peers and mentors who keep you on track.
        </SectionHead>
        <Carousel label="Cohorts">
          {COHORTS.map((c) => (
            <CohortCard key={c.name} name={c.name} href={c.href} center={c.center} orbit={c.orbit} />
          ))}
        </Carousel>
      </section>

      <section aria-labelledby="courses-head" className="mt-16 sm:mt-20">
        <SectionHead id="courses-head" title="Courses" action={{ label: 'View all', href: '/courses' }}>
          Learn at your own pace with structured, <Highlight>high-quality video lessons</Highlight>.
        </SectionHead>
        <Carousel label="Courses" arrows={false}>
          {COURSES.map((c, i) => (
            <a key={i} href={c.href} className="group block w-[290px] rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <MediaFrame src={c.image} alt="" />
              <h3 className="mt-2.5 ml-1 text-sm font-semibold text-gray-500 transition-colors group-hover:text-foreground dark:text-gray-300">{c.title}</h3>
            </a>
          ))}
        </Carousel>
      </section>

      <section aria-labelledby="why-head" className="mt-20 md:mt-24">
        <SectionHead id="why-head" title="Why learn with us">
          Our purpose is to make learning accountable, with <Highlight>progress you can see</Highlight> every week.
        </SectionHead>
        <FeatureBento features={FEATURES} />
      </section>

      <section id="reviews" aria-labelledby="reviews-head" className="mt-20 md:mt-24">
        <SectionHead id="reviews-head" title="What learners say">
          Straight from X, <Highlight>unedited</Highlight>.
        </SectionHead>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {REVIEWS.map((r) => (
            <ReviewCard key={r.username} name={r.name} username={r.username} href={r.href}>
              {r.text}
            </ReviewCard>
          ))}
        </div>
      </section>

      <CtaPanel
        className="mt-20 mb-8 md:mt-24"
        heading="Ready to ship your first project?"
        tagline="Join the next cohort and build with a community that finishes."
        action={{ label: 'Get started', href: '#cohorts' }}
      />
    </PageShell>
  )
}

export default LandingPage
