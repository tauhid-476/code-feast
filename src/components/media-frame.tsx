import { cn } from '@/lib/utils'

/**
 * The Trending frame (landing/trending.tsx): a rounded image with a hairline
 * ring, a little grey at rest that turns to full colour on hover, and a
 * vignette from the right edge on dark. Put it inside a link with a `group`
 * class, or it reacts to its own hover. Pass `srcDark` for an image made for
 * the dark theme.
 */
export function MediaFrame({
  src,
  srcDark,
  alt,
  className,
  imgClassName,
}: {
  src: string
  srcDark?: string
  alt: string
  className?: string
  imgClassName?: string
}) {
  const img = cn(
    'size-full object-cover transition-[filter,scale] duration-300 group-hover:grayscale-0 md:grayscale-20 motion-safe:group-hover:scale-[1.01]',
    imgClassName,
  )
  return (
    <div className={cn('group relative aspect-video overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10', className)}>
      <img src={src} alt={alt} className={cn(img, srcDark && 'dark:hidden')} loading="lazy" />
      {srcDark && <img src={srcDark} alt={alt} className={cn(img, 'hidden dark:block')} loading="lazy" />}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(200%_100%_at_0%_50%,transparent_30%,rgba(0,0,0,0.45)_70%)] opacity-10 dark:opacity-100"
      />
    </div>
  )
}
