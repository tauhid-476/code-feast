'use client'

import { ArrowUpDown, Grid2X2, List } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CardGrid, ListingHead, Toolbar } from '@/components/listing'
import { CourseCard, type Course } from '@/components/course-card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Highlight } from '@/components/ui/highlight'
import { iconButtonVariants } from '@/components/ui/icon-button'
import { LiveDot } from '@/components/ui/live-dot'
import { Segmented } from '@/components/ui/segmented'
import { PageShell } from '@/components/page-shell'

/**
 * chaicode.com's udemy page (routes/udemy/index.tsx) as a template: a
 * centred head, the toolbar with the count, a note, the sort menu and the
 * grid or list switch, then the course cards. Replace COURSES with yours.
 */
const COURSES: Course[] = [
  {
    title: 'FastAPI with GenAI',
    href: '/courses/fastapi',
    image: '/chaiui/demo/fastapi.svg',
    description: 'Build production-grade backends and ship AI features on top of them.',
    instructors: 'Hitesh Choudhary',
    badge: { label: 'Bestseller', variant: 'new' },
    rating: 4.7,
    chips: ['10.5 total hours', 'Hindi'],
    price: '₹499',
    originalPrice: '₹3,199',
  },
  {
    title: 'DevOps from zero',
    href: '/courses/devops',
    image: '/chaiui/demo/devops.svg',
    description: 'Linux, Docker, CI and the cloud, in the order you will actually need them.',
    instructors: 'Hitesh Choudhary, Piyush Garg',
    badge: { label: 'Hot & New', variant: 'hot' },
    rating: 4.8,
    chips: ['22 total hours', 'English'],
    price: '₹599',
    originalPrice: '₹3,999',
  },
  {
    title: 'Data structures in Java',
    href: '/courses/dsa',
    image: '/chaiui/demo/dsa.svg',
    description: 'Patterns, not puzzles. Every topic ends with the interview questions it unlocks.',
    instructors: 'Hitesh Choudhary',
    badge: { label: 'Highest Rated', variant: 'rated' },
    rating: 4.9,
    chips: ['31 total hours', 'Hindi'],
    price: '₹499',
    originalPrice: '₹2,999',
  },
]

type Sort = 'featured' | 'rating' | 'a-z'

export function ListingPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState<Sort>('featured')

  const sorted = useMemo(() => {
    if (sort === 'a-z') return [...COURSES].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'rating') return [...COURSES].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    return COURSES
  }, [sort])

  return (
    <PageShell>
      <ListingHead title="Courses">
        Learn at your own pace with structured, <Highlight>high-quality video lessons</Highlight> designed to give you real-world skills.
      </ListingHead>

      <Toolbar count={sorted.length} noun="courses" aside={<LiveDot tone="special">Available on Udemy for Business</LiveDot>}>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Sort courses" className={iconButtonVariants()}>
            <ArrowUpDown className="text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <DropdownMenuRadioItem value="featured">Featured</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="rating">Highest rated</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="a-z">A to Z</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Segmented
          label="Layout"
          value={view}
          onChange={setView}
          options={[
            { value: 'grid', label: <Grid2X2 aria-hidden="true" />, 'aria-label': 'Grid view' },
            { value: 'list', label: <List aria-hidden="true" />, 'aria-label': 'List view' },
          ]}
        />
      </Toolbar>

      {view === 'grid' ? (
        <CardGrid className="mt-2">
          {sorted.map((c) => (
            <CourseCard key={c.href} course={c} />
          ))}
        </CardGrid>
      ) : (
        <div className="mt-2 grid gap-6">
          {sorted.map((c) => (
            <CourseCard key={c.href} course={c} layout="list" />
          ))}
        </div>
      )}
    </PageShell>
  )
}

export default ListingPage
