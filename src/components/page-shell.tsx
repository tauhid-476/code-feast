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
    title: 'Platform',
    links: [
      { label: 'Join contest', href: '/join' },
      { label: 'Organizer events', href: '/admin/events' },
      { label: 'Features', href: '/#features' },
    ],
  },
  {
    title: 'Access',
    links: [
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Sign up', href: '/sign-up' },
      { label: 'ChaiUI design', href: 'https://ui.chaicode.com', external: true },
    ],
  },
  {
    title: 'Social',
    wide: true,
    links: [
      { label: 'x.com', href: 'https://x.com/tauhid_khan476', external: true },
      { label: 'GitHub', href: 'https://github.com/tauhid-476/code-feast', external: true },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/khan-tauhid-6a4664285', external: true },
      { label: 'Discord', href: 'https://discord.com/khantauheed_768', external: true },
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
        <Footer logo={<Logo />} owner="CodeFeast" sections={FOOTER_SECTIONS} />
      </div>
    </div>
  )
}
