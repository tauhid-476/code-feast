import {
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  FileCode2,
  Shield,
  ShieldAlert,
  Sparkles,
  Terminal,
} from 'lucide-react'

import { CtaPanel } from '@/components/cta-panel'
import { FeatureBento, type Feature } from '@/components/feature-bento'
import { Hero } from '@/components/hero'
import { SectionHead } from '@/components/section-head'
import { StatStrip } from '@/components/stat-strip'
import { Highlight } from '@/components/ui/highlight'
import { PageShell } from '@/components/page-shell'
import { Card, CardBody, CardTitle, CardText } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'

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

function ContestTerminalMock() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-black/90 p-4 font-mono text-xs text-neutral-300 shadow-2xl backdrop-blur-md">
      {/* Window bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-500/80" />
          <span className="size-2.5 rounded-full bg-yellow-500/80" />
          <span className="size-2.5 rounded-full bg-green-500/80" />
          <span className="ml-2 text-[11px] font-medium text-neutral-400">code-feast-workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="default" className="text-[10px] py-0 px-2">
            <Clock className="size-3" />
            42:15 remaining
          </Chip>
          <Chip tone="success" className="text-[10px] py-0 px-2">
            <ShieldAlert className="size-3 text-green-400" />
            0 / 3 strikes
          </Chip>
        </div>
      </div>

      {/* Editor tabs */}
      <div className="flex items-center gap-4 border-b border-white/10 pt-2 pb-2 text-[11px]">
        <span className="flex items-center gap-1.5 text-white font-medium border-b border-orange-200/80 pb-1 -mb-2">
          <Code2 className="size-3.5 text-orange-200" />
          Two Sum (Python 3)
        </span>
        <span className="text-neutral-500 hover:text-neutral-400 cursor-default">Valid Anagram</span>
        <span className="text-neutral-500 hover:text-neutral-400 cursor-default">LRU Cache</span>
      </div>

      {/* Code snippet */}
      <div className="py-3 text-[11px] leading-relaxed">
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">1</span>
          <span>
            <span className="text-purple-400">def</span> <span className="text-blue-400">two_sum</span>(nums: list[int], target: int) -&gt; list[int]:
          </span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">2</span>
          <span className="pl-4 text-neutral-500"># Store compliment indices</span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">3</span>
          <span className="pl-4">lookup = &#123;&#125;</span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">4</span>
          <span className="pl-4">
            <span className="text-purple-400">for</span> idx, val <span className="text-purple-400">in</span> enumerate(nums):
          </span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">5</span>
          <span className="pl-8">
            diff = target - val
          </span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">6</span>
          <span className="pl-8">
            <span className="text-purple-400">if</span> diff <span className="text-purple-400">in</span> lookup:
          </span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">7</span>
          <span className="pl-12">
            <span className="text-purple-400">return</span> [lookup[diff], idx]
          </span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">8</span>
          <span className="pl-8">lookup[val] = idx</span>
        </div>
        <div className="flex gap-3">
          <span className="select-none text-neutral-600">9</span>
          <span className="pl-4">
            <span className="text-purple-400">return</span> []
          </span>
        </div>
      </div>

      {/* Runner output console */}
      <div className="rounded-lg border border-white/10 bg-black/60 p-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/5 text-[10px]">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <Terminal className="size-3 text-neutral-400" />
            Sandbox Run Output (E2B)
          </span>
          <span className="flex items-center gap-1 text-green-400 font-medium">
            <CheckCircle2 className="size-3" />
            2 / 2 sample cases passed
          </span>
        </div>
        <div className="pt-2 flex flex-col gap-1 text-[10px] text-neutral-400">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">Case 1: nums = [2,7,11,15], target = 9</span>
            <span className="text-neutral-500">14ms · stdout: [0, 1]</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">Case 2: nums = [3,2,4], target = 6</span>
            <span className="text-neutral-500">11ms · stdout: [1, 2]</span>
          </div>
        </div>
      </div>
    </div>
  )
}

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
        media={<ContestTerminalMock />}
      >
        Execute live contests with <Highlight>zero client drift</Highlight>, sandboxed multi-language runtimes, and automated anti-cheat proctoring.
      </Hero>

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
                <CardText className="text-sm leading-relaxed text-muted-foreground">{s.description}</CardText>
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
