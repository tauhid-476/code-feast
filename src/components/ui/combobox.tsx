'use client'

import { Command } from 'cmdk'
import { Check, ChevronsUpDown } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { inputClass } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * A select you can type into, for lists too long to scroll: topics,
 * companies, countries. cmdk does the filtering and the arrow keys. The
 * chosen option carries a tick; the trigger looks like the toolbar input.
 */
function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Choose one',
  searchPlaceholder = 'Search',
  empty = 'Nothing matches that.',
  label,
  className,
}: {
  options: { value: string; label: string }[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  empty?: string
  /** Names the control when there is no visible label. */
  label?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        className={cn(inputClass, 'flex w-56 cursor-pointer items-center justify-between gap-2 text-left', !current && 'text-muted-foreground', className)}
      >
        <span className="truncate">{current?.label ?? placeholder}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-1.5">
        <Command className="flex flex-col">
          <Command.Input
            placeholder={searchPlaceholder}
            className="mb-1 h-9 w-full border-b border-border bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-64 overflow-y-auto">
            <Command.Empty className="px-2 py-3 text-sm text-muted-foreground">{empty}</Command.Empty>
            {options.map((o) => (
              <Command.Item
                key={o.value}
                value={o.label}
                onSelect={() => {
                  onChange(o.value === value ? null : o.value)
                  setOpen(false)
                }}
                className="relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 pr-8 text-sm outline-none select-none data-[selected=true]:bg-accent/60 data-[selected=true]:text-brand"
              >
                {o.label}
                {o.value === value && <Check className="absolute right-2 size-4" aria-hidden="true" />}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }
