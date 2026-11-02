'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'

/** Several independent choices with one value: an array of the checked options. */
function CheckboxGroup({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: string; label: React.ReactNode; hint?: React.ReactNode; disabled?: boolean }[]
  value: string[]
  onChange: (value: string[]) => void
  className?: string
}) {
  return (
    <div data-slot="checkbox-group" className={cn('grid gap-2.5', className)}>
      {options.map((o) => (
        <label key={o.value} className={cn('flex cursor-pointer items-start gap-3 text-sm', o.disabled && 'cursor-not-allowed opacity-50')}>
          <Checkbox
            className="mt-0.5"
            disabled={o.disabled}
            checked={value.includes(o.value)}
            onCheckedChange={(on) => onChange(on === true ? [...value, o.value] : value.filter((v) => v !== o.value))}
          />
          <span>
            {o.label}
            {o.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}

export { CheckboxGroup }
