import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Where a page sits, as on Chai Prep's sheet pages ("Practice sheets /
 * Array"). Earlier steps are grey links that hover to the brand; the last
 * one is the current page, in white, not a link.
 */
function Breadcrumbs({ items, className }: { items: { label: React.ReactNode; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((it, i) => {
          const last = i === items.length - 1
          return (
            <li key={i} className="inline-flex items-center gap-1.5">
              {last || !it.href ? (
                <span className={cn(last && 'text-foreground')} aria-current={last ? 'page' : undefined}>
                  {it.label}
                </span>
              ) : (
                <a href={it.href} className="transition-colors duration-200 hover:text-brand">
                  {it.label}
                </a>
              )}
              {!last && (
                <span aria-hidden="true" className="text-muted-foreground/60">
                  /
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Breadcrumbs }
