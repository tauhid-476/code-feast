import Link from "next/link";
import { CalendarDays, Code2, LogIn } from 'lucide-react'
import * as React from 'react'

import { Footer, type FooterSection } from '@/components/footer'
import { Navbar, type NavLink } from '@/components/navbar'
import { Backdrop } from '@/components/backdrop'
import { Logo } from '@/components/logo'

/**
 * The frame every ChaiUI page sits in, as chaicode.com's root layout does it:
 * the background image, the sticky navbar, one max-w-6xl column with
 * p-6 sm:p-12, and the footer. The links live here, once, for every page.
 * Edit NAV_LINKS and FOOTER_SECTIONS for your site.
 */
export const NAV_LINKS: NavLink[] = [
  { label: 'Join contest', href: '/join', icon: <Code2 className="size-4" /> },
  { label: 'Events', href: '/admin/events', icon: <CalendarDays className="size-4" /> },
  { label: 'Sign in', href: '/sign-in', icon: <LogIn className="size-4" /> },
]

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    title: 'Products',
    links: [
      { label: 'Courses', href: '/courses' },
      { label: 'Cohorts', href: '/#cohorts' },
      { label: 'Events', href: '/events' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'Privacy policy', href: '/privacy-policy' },
      { label: 'Terms of service', href: '/terms-of-service' },
    ],
  },
  {
    title: 'Social',
    wide: true,
    links: [
      { label: 'x.com', href: 'https://x.com/ChaiCodeHQ', external: true },
      { label: 'GitHub', href: 'https://github.com/hiteshchoudhary', external: true },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/chaicodehq/', external: true },
      { label: 'YouTube', href: 'https://www.youtube.com/@chaiaurcode', external: true },
    ],
  },
]

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Backdrop />
      <div className="sm:max-w-6xl lg:mx-auto">
        <Navbar
          logo={
            <Link href="/" aria-label="Home" className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <Logo />
            </Link>
          }
          links={NAV_LINKS}
        />
        <main className="flex flex-col gap-y-4 p-6 sm:p-12">{children}</main>
        <Footer logo={<Logo />} sections={FOOTER_SECTIONS} />
      </div>
    </div>
  )
}
