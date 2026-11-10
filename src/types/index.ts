export type TeamType = 'BE' | 'FE' | 'APP'
export type StatusType = 'WIP' | 'QA' | 'In Design' | 'Todo' | 'Completed' | 'Done' | 'Stopped' | 'Blocked' | 'Deprioritized'
export type OwnerType = string   // dynamic — stored in state.ownerList
export type PriorityType = 'p0' | 'p1' | 'p2'

export const DEFAULT_OWNERS: string[] = ['GC', 'Bikash', 'Atul', 'Swastik', 'Atinder']
export type QuarterType = "OND'26" | "JFM'27" | "AMJ'27" | "JAS'27"

export interface Capacity {
  be: number
  app: number
  fe: number
}

export interface Project {
  id: string
  businessLine: string
  roadmapItem: string
  owner: OwnerType
  quarter: QuarterType
  ticketReadyDate: string | null
  capacity: Capacity
  status: StatusType
  priority: PriorityType
  jira?: string
  comment?: string
  taskType?: string
  effort?: string
}

export interface Dev {
  name: string
  team: TeamType
  totalSprints: number   // 6 = full rate, 4 = 4/6 rate, 2 = 2/6 rate
  owners: OwnerType[]
}

export interface DevAssignment {
  projectId: string
  beDevs: string[]
  appDevs: string[]
  feDevs: string[]
}

// ── Schedule output types ────────────────────────────────────────────────────

export interface SprintBlock {
  projectId: string
  fraction: number      // 0–1 of this dev's capacity in this sprint
  sprintsUsed: number   // sprint units actually consumed
}

export interface DevTimeline {
  devName: string
  team: TeamType
  perSprintCapacity: number              // base computed (bandwidth × 5/36)
  sprintCapacity: Record<number, number> // original capacity per sprint (may be overridden)
  sprints: Record<number, SprintBlock[]> // sprint → blocks
}

export interface ProjectScheduleResult {
  projectId: string
  beStart: number | null
  beEnd: number | null
  be60Sprint: number | null   // sprint where BE hits 60% completion
  appStart: number | null
  appEnd: number | null
  feStart: number | null
  feEnd: number | null
  overallStart: number
  overallEnd: number
  isAtRisk: boolean           // overallEnd > 6 OR any capacity unscheduled
  assignedDevs: { be: string[]; app: string[]; fe: string[] }
  unscheduled: { be: number; app: number; fe: number }
}

export interface ScheduleResult {
  projectSchedules: Record<string, ProjectScheduleResult>
  devTimelines: Record<string, DevTimeline>
}
