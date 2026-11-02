'use client'

import { Pause, Play } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Disclosure, DisclosureContent, DisclosureTrigger } from '@/components/disclosure'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

/**
 * chaicode.com's two kinds of proof (testimonials.tsx, review-card.tsx).
 *
 * VideoTestimonial: a portrait video with a frosted name bar that opens on
 * hover to show the batch and links. Click to play; only one plays at a
 * time inside a <TestimonialGroup>.
 *
 * ReviewCard: a quote from X with the avatar, name, verified tick and handle.
 */
const PlayingContext = React.createContext<{ playing: string | null; setPlaying: (id: string | null) => void }>({
  playing: null,
  setPlaying: () => {},
})

export function TestimonialGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const [playing, setPlaying] = React.useState<string | null>(null)
  return (
    <PlayingContext value={{ playing, setPlaying }}>
      <div className={className}>{children}</div>
    </PlayingContext>
  )
}

export function VideoTestimonial({
  name,
  batch,
  video,
  poster,
  links,
  className,
}: {
  name: string
  batch?: string
  video: string
  poster?: string
  /** Shown in the opened name bar, e.g. X and LinkedIn icons as links. */
  links?: React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLVideoElement>(null)
  const { playing, setPlaying } = React.use(PlayingContext)
  const [paused, setPaused] = React.useState(true)

  React.useEffect(() => {
    if (playing !== name && ref.current && !ref.current.paused) ref.current.pause()
  }, [playing, name])

  const toggle = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      setPlaying(name)
      void v.play()
    } else v.pause()
  }

  return (
    <div className={cn('relative aspect-[3/4] w-[260px] overflow-hidden rounded-xl bg-black ring-1 ring-black/10 dark:ring-white/10', className)}>
      <video
        ref={ref}
        src={video}
        poster={poster}
        playsInline
        preload="none"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onEnded={() => {
          setPlaying(null)
          if (ref.current) ref.current.currentTime = 0
        }}
        className="size-full object-cover"
      />
      <Disclosure openOnHover className="absolute inset-x-0 bottom-0 mx-3 my-2 flex flex-col rounded-lg bg-black/30 p-4 ring-1 ring-gray-400/10 backdrop-blur-md ring-inset">
        <div className="flex items-center justify-between gap-3">
          <DisclosureTrigger className="min-w-0 truncate text-left font-montserrat text-lg font-medium text-white">{name}</DisclosureTrigger>
          <button
            type="button"
            onClick={toggle}
            aria-label={paused ? `Play ${name}'s story` : `Pause ${name}'s story`}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-white/15 text-white transition-colors outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white"
          >
            {paused ? <Play className="size-3.5 fill-current" aria-hidden="true" /> : <Pause className="size-3.5 fill-current" aria-hidden="true" />}
          </button>
        </div>
        <DisclosureContent>
          <div className="flex flex-col gap-3 pt-3">
            {batch && <p className="text-sm font-medium text-white/90">{batch}</p>}
            {links && <div className="flex gap-4 text-white [&_a]:transition-colors [&_a:hover]:text-brand [&_svg]:size-4">{links}</div>}
          </div>
        </DisclosureContent>
      </Disclosure>
    </div>
  )
}

export function ReviewCard({
  name,
  username,
  avatar,
  href,
  children,
  className,
}: {
  name: string
  username: string
  avatar?: string
  /** The post on X. */
  href: string
  /** The review text. */
  children: React.ReactNode
  className?: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Read ${name}'s review on X`} className={cn('block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}>
      <figure className="flex flex-col gap-6 rounded-xl border border-card-edge bg-white/70 p-9 backdrop-blur-sm transition-[border-color,opacity] duration-300 hover:border-card-edge-hover sm:opacity-90 md:hover:opacity-100 dark:bg-stone-950">
        <blockquote className="text-gray-600 dark:text-gray-300">{children}</blockquote>
        <figcaption className="flex items-center gap-4">
          <Avatar className="size-12">
            {avatar && <AvatarImage src={avatar} alt="" />}
            <AvatarFallback className="bg-gray-300/60 dark:bg-black/30">{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center font-montserrat text-lg font-medium tracking-tight">
              <span className="truncate">{name}</span>
              <Verified />
            </span>
            <span className="-mt-0.5 font-onest font-thin tracking-tighter text-gray-500 dark:text-gray-400">@{username}</span>
          </span>
        </figcaption>
      </figure>
    </a>
  )
}

function Verified() {
  return (
    <svg viewBox="0 0 24 24" className="ml-1 size-4 shrink-0 text-blue-500 dark:text-blue-400" role="img" aria-label="Verified">
      <path
        fill="currentColor"
        d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"
      />
    </svg>
  )
}
