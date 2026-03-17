'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@mdplane/ui/lib/utils'
import { CircleDot, Folder, Users, type LucideIcon } from 'lucide-react'
import { ORCHESTRATION_PRIORITY_META, ORCHESTRATION_STATUS_META, ORCHESTRATION_STATUS_ORDER } from './orchestration-meta'
import type { OrchestrationStatus } from '@/hooks'

export interface OrchestrationViewFilters {
  status: OrchestrationStatus[]
  priority: Array<keyof typeof ORCHESTRATION_PRIORITY_META>
  agent: string | null
  folder: string | null
}

interface FilterOption {
  value: string
  label: string
  icon?: LucideIcon
  iconClassName?: string
  dotClassName?: string
}

const STATUS_OPTIONS: FilterOption[] = ORCHESTRATION_STATUS_ORDER.map((status) => ({
  value: status,
  label: ORCHESTRATION_STATUS_META[status].label,
  icon: ORCHESTRATION_STATUS_META[status].icon,
  iconClassName: ORCHESTRATION_STATUS_META[status].iconClassName,
}))

const PRIORITY_OPTIONS: FilterOption[] = (Object.keys(ORCHESTRATION_PRIORITY_META) as Array<keyof typeof ORCHESTRATION_PRIORITY_META>).map((priority) => ({
  value: priority,
  label: ORCHESTRATION_PRIORITY_META[priority].label,
  dotClassName: ORCHESTRATION_PRIORITY_META[priority].dotClassName,
}))

const ALL_AGENTS_VALUE = '__all__'
const ALL_FOLDERS_VALUE = '__all__'
const ALL_STATUSES_VALUE = '__all__'
const ALL_PRIORITIES_VALUE = '__all__'

function renderMultiSummary(value: string[], options: FilterOption[], allLabel: string): string {
  if (value.length === 0) return allLabel
  const optionMap = new Map(options.map((option) => [option.value, option.label]))
  const first = optionMap.get(value[0]) ?? value[0]
  if (value.length === 1) return first
  return `${first} (+${value.length - 1} more)`
}

function OptionLabel({ option }: { option: FilterOption }) {
  const Icon = option.icon

  return (
    <span className='inline-flex min-h-4 items-center gap-2'>
      {Icon ? <Icon className={cn('h-4 w-4', option.iconClassName)} aria-hidden /> : null}
      {option.dotClassName ? <span className={cn('inline-block h-2.5 w-2.5 rounded-full', option.dotClassName)} aria-hidden /> : null}
      <span>{option.label}</span>
    </span>
  )
}

function AllOptionLabel({ label }: { label: string }) {
  return (
    <span className='inline-flex min-h-4 items-center gap-2'>
      <span className='inline-block h-4 w-4 shrink-0' aria-hidden />
      <span>{label}</span>
    </span>
  )
}

function MultiFilterSelect({
  title,
  icon,
  value,
  options,
  allLabel,
  allValue,
  onChange,
}: {
  title: string
  icon: LucideIcon
  value: string[]
  options: FilterOption[]
  allLabel: string
  allValue: string
  onChange: (next: string[]) => void
}) {
  const summary = renderMultiSummary(value, options, allLabel)

  return (
    <Select<string, true>
      multiple
      value={value}
      onValueChange={(next, details) => {
        if (details.reason !== 'item-press' && details.reason !== 'list-navigation') {
          return
        }
        const selected = Array.isArray(next) ? next : []
        if (selected.includes(allValue)) {
          onChange([])
          return
        }
        onChange(selected.filter((item) => item !== allValue))
      }}
    >
      <SelectTrigger
        aria-label={`Choose ${title.toLowerCase()}`}
        className={cn(
          'h-auto min-h-10 w-full cursor-pointer items-center justify-start gap-2 rounded-md border border-input bg-input/30 px-3 text-sm text-foreground shadow-xs',
          'hover:bg-accent/40 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
        )}
      >
        <IconPlaceholder icon={icon} />
        <SelectValue className='min-w-0 flex-1 truncate text-left text-sm'>{summary}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>
          <AllOptionLabel label={allLabel} />
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <OptionLabel option={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SingleFilterSelect({
  title,
  icon,
  value,
  options,
  allLabel,
  allValue,
  onChange,
}: {
  title: string
  icon: LucideIcon
  value: string | null
  options: FilterOption[]
  allLabel: string
  allValue: string
  onChange: (next: string | null) => void
}) {
  const selectedValue = value ?? allValue
  const optionMap = new Map(options.map((option) => [option.value, option.label]))
  const selectedLabel = value ? optionMap.get(value) ?? value : allLabel

  return (
    <Select<string>
      value={selectedValue}
      onValueChange={(next, details) => {
        if (details.reason !== 'item-press' && details.reason !== 'list-navigation') {
          return
        }
        onChange(next === allValue ? null : next)
      }}
    >
      <SelectTrigger
        aria-label={`Choose ${title.toLowerCase()}`}
        className={cn(
          'h-auto min-h-10 w-full cursor-pointer items-center justify-start gap-2 rounded-md border border-input bg-input/30 px-3 text-sm text-foreground shadow-xs',
          'hover:bg-accent/40 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
        )}
      >
        <IconPlaceholder icon={icon} />
        <SelectValue className='min-w-0 flex-1 truncate text-left text-sm'>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>
          <AllOptionLabel label={allLabel} />
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <OptionLabel option={option} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function IconPlaceholder({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className='h-4 w-4 shrink-0 text-muted-foreground' aria-hidden />
}

export function OrchestrationFilterBar({
  filters,
  agents,
  folders,
  onFiltersChange,
}: {
  filters: OrchestrationViewFilters
  agents: string[]
  folders: string[]
  onFiltersChange: (next: OrchestrationViewFilters) => void
}) {
  const agentOptions: FilterOption[] = agents.map((agent) => ({
    value: agent,
    label: agent,
    icon: Users,
  }))

  const folderOptions: FilterOption[] = folders.map((folderPath) => ({
    value: folderPath,
    label: folderPath,
    icon: Folder,
  }))

  return (
    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4' data-testid='orchestration-filter-bar'>
      <MultiFilterSelect
        title='Status'
        icon={CircleDot}
        value={filters.status}
        options={STATUS_OPTIONS}
        allLabel='All statuses'
        allValue={ALL_STATUSES_VALUE}
        onChange={(status) => onFiltersChange({ ...filters, status: status as OrchestrationStatus[] })}
      />

      <MultiFilterSelect
        title='Priority'
        icon={CircleDot}
        value={filters.priority}
        options={PRIORITY_OPTIONS}
        allLabel='All priorities'
        allValue={ALL_PRIORITIES_VALUE}
        onChange={(priority) =>
          onFiltersChange({
            ...filters,
            priority: priority as Array<keyof typeof ORCHESTRATION_PRIORITY_META>,
          })
        }
      />

      <SingleFilterSelect
        title='Agent'
        icon={Users}
        value={filters.agent}
        options={agentOptions}
        allLabel='All agents'
        allValue={ALL_AGENTS_VALUE}
        onChange={(agent) => onFiltersChange({ ...filters, agent })}
      />

      <SingleFilterSelect
        title='Folder'
        icon={Folder}
        value={filters.folder}
        options={folderOptions}
        allLabel='All folders'
        allValue={ALL_FOLDERS_VALUE}
        onChange={(folder) => onFiltersChange({ ...filters, folder })}
      />
    </div>
  )
}
