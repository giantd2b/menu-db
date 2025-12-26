'use client'

import * as React from 'react'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type DateRange as DayPickerDateRange } from 'react-day-picker'

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
  className?: string
}

export default function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const formatDateRange = () => {
    if (value.from && value.to) {
      return `${format(value.from, 'd MMM yyyy', { locale: th })} - ${format(value.to, 'd MMM yyyy', { locale: th })}`
    }
    if (value.from) {
      return format(value.from, 'd MMM yyyy', { locale: th })
    }
    return 'เลือกช่วงวันที่'
  }

  const handleSelect = (range: DayPickerDateRange | undefined) => {
    if (range) {
      onChange({ from: range.from, to: range.to })
      if (range.from && range.to) {
        setIsOpen(false)
      }
    }
  }

  const handleClear = () => {
    onChange({ from: undefined, to: undefined })
    setIsOpen(false)
  }

  const handlePreset = (days: number) => {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - days)
    onChange({ from, to })
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !value.from && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col">
          {/* Preset buttons */}
          <div className="flex gap-2 p-3 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreset(7)}
            >
              7 วัน
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreset(30)}
            >
              30 วัน
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePreset(90)}
            >
              90 วัน
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
            >
              ล้าง
            </Button>
          </div>

          {/* Calendar */}
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value.from}
            selected={value as DayPickerDateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={th}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
