'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', abbr: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', abbr: 'EST/EDT' },
  { value: 'America/Chicago', label: 'Central Time (CT)', abbr: 'CST/CDT' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', abbr: 'MST/MDT' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', abbr: 'PST/PDT' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKST)', abbr: 'AKST/AKDT' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', abbr: 'HST' },
  { value: 'America/Puerto_Rico', label: 'Atlantic Time (AST)', abbr: 'AST' },
  { value: 'Pacific/Guam', label: 'Guam Time', abbr: 'ChST' },
  { value: 'Pacific/Saipan', label: 'Northern Mariana Islands Time', abbr: 'ChST' },
] as const

interface TimezoneSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function TimezoneSelect({ 
  value, 
  onValueChange, 
  placeholder = "Select timezone",
  disabled = false 
}: TimezoneSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONES.map((tz) => (
          <SelectItem key={tz.value} value={tz.value}>
            <div className="flex items-center justify-between w-full">
              <span>{tz.label}</span>
              <span className="text-xs text-gray-500 ml-2">({tz.abbr})</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}