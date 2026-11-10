export const SPRINTS = [3, 4, 5, 6] as const
export type SprintNumber = 3 | 4 | 5 | 6

// Sprint start dates (Monday of each sprint)
export const SPRINT_START_DATES: Record<number, string> = {
  1: '2026-10-13',
  2: '2026-10-27',
  3: '2026-11-09',
  4: '2026-11-23',
  5: '2026-12-07',
  6: '2026-12-21',
}

export const SPRINT_END_DATES: Record<number, string> = {
  1: '2026-10-26',
  2: '2026-11-08',
  3: '2026-11-22',
  4: '2026-12-06',
  5: '2026-12-20',
  6: '2027-01-03',
}

export const SPRINT_LABELS: Record<number, string> = {
  3: 'S3  Nov 9–22',
  4: 'S4  Nov 23–Dec 6',
  5: 'S5  Dec 7–20',
  6: 'S6  Dec 21–Jan 3',
}

export const STATUS_COLORS: Record<string, string> = {
  'WIP': 'bg-blue-500',
  'In Design': 'bg-purple-500',
  'Todo': 'bg-gray-500',
  'Done': 'bg-green-500',
  'Blocked': 'bg-red-500',
  'Deprioritized': 'bg-gray-700',
}

export const STATUS_OPTIONS = ['WIP', 'In Design', 'Todo', 'Done', 'Blocked', 'Deprioritized'] as const

// Minimum estimation unit in sprints
export const MIN_SPRINT_UNIT = 0.5
