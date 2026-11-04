import Image from 'next/image'
import {
  Cpu,
  FileCode2,
  Shield,
  Sparkles,
} from 'lucide-react'

import { CtaPanel } from '@/components/cta-panel'
import { FeatureBento, type Feature } from '@/components/feature-bento'
import { Hero } from '@/components/hero'
import { SectionHead } from '@/components/section-head'
import { StatStrip } from '@/components/stat-strip'
import { Highlight } from '@/components/ui/highlight'
import { PageShell } from '@/components/page-shell'
import { Card, CardBody, CardTitle, CardText } from '@/components/ui/card'

const FEATURES: Feature[] = [
  {
    title: 'Synchronized clock',
    description: 'A server-owned countdown reconciling on every poll. When time expires, lockouts happen immediately.',
    tone: 'amber',
  },
  {
    title: 'Pre-warmed sandbox pool',
    description: 'Sub-second code execution using isolated microVMs for Python 3, Java, and C++.',
    tone: 'blue',
  },
  {
    title: 'Multi-tab deterrence',
    description: 'Active session handshakes detect concurrent tabs instantly, assigning strikes to prevented takeovers.',
    tone: 'purple',
  },
  {
    title: 'Proctored workspace',
    description: 'Monitored fullscreen gate detects blur and visibility changes with automated strike logging.',
    tone: 'grey',
  },
  {
    title: 'Instant organizer review',
    description: 'Inspect live code submissions, re-run solutions against test suites, and shortlist candidates.',
    tone: 'blue',
    link: { label: 'Organizer events', href: '/admin/events' },
  },
  {
    title: 'Confidential test harnesses',
    description: 'Evaluation harnesses are appended server-side, keeping test internals hidden from client inspect.',
    tone: 'amber',
  },
  {
    title: 'Automated lockout',
    description: 'Elimination rules trigger automatically upon the third strike, freezing submitted code safely.',
    tone: 'purple',
  },
]

const STATS = [
  { value: '3', label: 'Supported languages' },
  { value: '< 1s', label: 'Sandbox execution latency' },
  { value: '3 strikes', label: 'Proctoring tolerance' },
  { value: '100%', label: 'Server-reconciled clock' },
]

const STEPS = [
  {
    num: '01',
    title: 'Author and configure',
    description:
      'Craft problems with Markdown statements, starter templates, and custom verification harnesses across Python, Java, and C++.',
    icon: <FileCode2 className="size-5 text-amber-500" />,
  },
  {
    num: '02',
    title: 'Launch and proctor',
    description:
      'Distribute a 6-character event code. Participants enter a fullscreen workspace while the shared clock keeps time synchronized.',
    icon: <Shield className="size-5 text-blue-500" />,
  },
  {
    num: '03',
    title: 'Review and shortlist',
    description:
      'Examine participant code, re-run against test suites with execution metrics, and bookmark top candidates with zero delay.',
    icon: <Cpu className="size-5 text-purple-500" />,
  },
]

export function LandingPage() {
  return (
    <PageShell>
      <Hero
        badge={
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            Live DSA Contest Platform
          </span>
        }
        title="Host synchronized coding competitions"
        primary={{ label: 'Join contest', href: '/join' }}
        secondary={{ label: 'Explore features', href: '#features' }}
      >
        Execute live contests with <Highlight>zero client drift</Highlight>, sandboxed multi-language runtimes, and automated anti-cheat proctoring.
      </Hero>

      {/* Platform Workspace Showcase */}
      <div className="relative mx-auto mt-12 w-full max-w-6xl sm:mt-16">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl transition-all duration-300 dark:border-white/10 dark:bg-black/40">
          {/* Window Header */}
          <div className="flex h-10 items-center justify-between border-b border-border/60 bg-muted/40 px-4 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-red-500/80" />
              <span className="size-2.5 rounded-full bg-yellow-500/80" />
              <span className="size-2.5 rounded-full bg-green-500/80" />
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                code-feast-workspace · live contest session
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="hidden sm:inline-block font-mono">Multi-Asset & File Attachments</span>
            </div>
          </div>

          {/* Screenshot Display with Dynamic Dark/Light Theme Switching */}
          <div className="relative aspect-[2940/1846] w-full bg-muted/20">
            <Image
              src="/assets/tree_light.png"
              alt="Code Feast live contest workspace with graph problem and file attachments in light theme"
              width={2940}
              height={1846}
              priority
              className="block h-full w-full object-cover dark:hidden"
            />
            <Image
              src="/assets/tree_dark.png"
              alt="Code Feast live contest workspace with graph problem and file attachments in dark theme"
              width={2940}
              height={1846}
              priority
              className="hidden h-full w-full object-cover dark:block"
            />
          </div>
        </div>
      </div>

      <StatStrip className="mt-16 sm:mt-20" stats={STATS} />

      <section id="features" aria-labelledby="features-head" className="mt-20 md:mt-24">
        <SectionHead id="features-head" title="Engineered for competitive integrity">
          Every contest runs on isolated infrastructure to ensure <Highlight>consistent, tamper-proof evaluation</Highlight>.
        </SectionHead>
        <FeatureBento features={FEATURES} />
      </section>

      <section aria-labelledby="how-it-works-head" className="mt-20 md:mt-24">
        <SectionHead id="how-it-works-head" title="How Code Feast works">
          From problem authoring to post-contest review in <Highlight>three seamless stages</Highlight>.
        </SectionHead>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.num} className="p-6 transition-all duration-300 hover:border-accent-foreground/30">
              <CardBody className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-montserrat text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Step {s.num}
                  </span>
                  {s.icon}
                </div>
                <CardTitle className="text-xl font-semibold">{s.title}</CardTitle>
                <CardText className="line-clamp-none text-sm leading-relaxed text-muted-foreground">{s.description}</CardText>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <CtaPanel
        className="mt-20 mb-8 md:mt-24"
        heading="Ready to run your next live contest?"
        tagline="Create an event in seconds, author custom challenges, and manage submissions with confidence."
        action={{ label: 'Host an event', href: '/admin/events' }}
      />
    </PageShell>
  )
}

export default LandingPage
