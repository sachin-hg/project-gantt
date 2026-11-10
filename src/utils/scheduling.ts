import type {
  Dev, Project, OwnerType, TeamType,
  DevAssignment, SprintBlock, DevTimeline, ProjectScheduleResult, ScheduleResult,
} from '../types'

export const PLANNING_SPRINTS = [3, 4, 5, 6] as const
export type SprintNum = 3 | 4 | 5 | 6

// ── Sprint calendar ──────────────────────────────────────────────────────────
const SPRINT_STARTS: Record<number, number> = {
  3: new Date('2026-11-09').getTime(),
  4: new Date('2026-11-23').getTime(),
  5: new Date('2026-12-07').getTime(),
  6: new Date('2026-12-21').getTime(),
}

export const SPRINT_LABELS: Record<number, string> = {
  3: 'S3  Nov 9–22',
  4: 'S4  Nov 23–Dec 6',
  5: 'S5  Dec 7–20',
  6: 'S6  Dec 21–Jan 3',
}

// Returns the earliest sprint whose START is on or after the ticket date.
// A date mid-sprint (e.g. Nov 15, inside S3 Nov 9–22) maps to the NEXT sprint
// so projects never appear to begin before their tickets are ready.
export function dateToSprint(iso: string | null): number {
  if (!iso) return 3
  const t = new Date(iso).getTime()
  if (t <= SPRINT_STARTS[3]) return 3
  if (t <= SPRINT_STARTS[4]) return 4
  if (t <= SPRINT_STARTS[5]) return 5
  if (t <= SPRINT_STARTS[6]) return 6
  return 7  // beyond last sprint — won't be schedulable this quarter
}

// ── Dev capacity ─────────────────────────────────────────────────────────────
// Rule: perSprint = bandwidth × 5/36
//   = (bandwidth/6) rate × (5/6) after 1/6 tech deduction, applied uniformly each sprint
export function perSprintCapacity(bandwidth: number): number {
  return (bandwidth * 5) / 36
}

export function buildSprintCapMap(
  dev: Dev,
  overrides: Record<number, number>,
): Record<number, number> {
  const base = perSprintCapacity(dev.totalSprints)
  const map: Record<number, number> = {}
  for (const sp of PLANNING_SPRINTS) {
    map[sp] = overrides[sp] !== undefined ? overrides[sp] : base
  }
  return map
}

// ── Project color palette ─────────────────────────────────────────────────────
export const PROJECT_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171',
  '#22d3ee', '#fb923c', '#e879f9', '#a3e635', '#2dd4bf',
  '#818cf8', '#facc15', '#4ade80', '#c084fc', '#fb7185',
  '#38bdf8', '#f472b6', '#94a3b8', '#d97706', '#06b6d4',
  '#8b5cf6', '#10b981', '#ef4444', '#3b82f6', '#f97316',
]

export function projectColor(index: number): string {
  return PROJECT_COLORS[index % PROJECT_COLORS.length]
}

// ── Scheduler helpers ─────────────────────────────────────────────────────────
interface FillResult {
  startSprint: number | null
  endSprint: number | null
  be60Sprint?: number | null
  unscheduled: number
  devNames: string[]
}

function totalAvail(devName: string, cap: Record<string, Record<number, number>>, from: number): number {
  return PLANNING_SPRINTS.filter(s => s >= from).reduce((s, sp) => s + (cap[devName]?.[sp] ?? 0), 0)
}

function allocateOneDev(
  dev: Dev,
  projectId: string,
  capacityNeeded: number,
  mutableCap: Record<string, Record<number, number>>,
  origCap: Record<string, Record<number, number>>,
  timelines: Record<string, DevTimeline>,
  earliestSprint: number,
  preworkFraction?: number,  // 0.0–1.0; if set, track the sprint where this fraction is reached
): FillResult {
  let remaining = capacityNeeded
  let startSprint: number | null = null
  let endSprint: number | null = null
  let be60Sprint: number | null = null  // reused field: "sprint where prework% of BE is done"
  let cumAllocated = 0

  for (const sp of PLANNING_SPRINTS) {
    if (sp < earliestSprint) continue
    if (remaining <= 0.001) break

    const avail = mutableCap[dev.name]?.[sp] ?? 0
    if (avail <= 0.001) continue

    const toUse = Math.min(avail, remaining)
    const orig = origCap[dev.name]?.[sp] ?? avail
    const fraction = orig > 0 ? Math.min(1, toUse / orig) : 1

    mutableCap[dev.name][sp] = Math.max(0, avail - toUse)
    remaining -= toUse
    cumAllocated += toUse

    timelines[dev.name].sprints[sp] = [
      ...(timelines[dev.name].sprints[sp] ?? []),
      { projectId, fraction, sprintsUsed: toUse } satisfies SprintBlock,
    ]

    if (startSprint === null) startSprint = sp
    endSprint = sp

    if (preworkFraction !== undefined && be60Sprint === null && cumAllocated >= preworkFraction * capacityNeeded) {
      be60Sprint = sp
    }
  }

  return {
    startSprint,
    endSprint,
    be60Sprint: preworkFraction !== undefined ? be60Sprint : undefined,
    unscheduled: Math.max(0, remaining),
    devNames: startSprint !== null ? [dev.name] : [],
  }
}

// Auto mode: pick the single best-fit dev (most total capacity, preferring ones that can complete alone)
function singleDevFill(
  projectId: string,
  capacityNeeded: number,
  eligibleDevs: Dev[],
  mutableCap: Record<string, Record<number, number>>,
  origCap: Record<string, Record<number, number>>,
  timelines: Record<string, DevTimeline>,
  earliestSprint: number,
  preworkFraction?: number,
): FillResult {
  if (capacityNeeded <= 0) return { startSprint: null, endSprint: null, unscheduled: 0, devNames: [] }
  if (eligibleDevs.length === 0) return { startSprint: null, endSprint: null, unscheduled: capacityNeeded, devNames: [] }

  const withTotals = eligibleDevs.map(dev => ({
    dev,
    total: totalAvail(dev.name, mutableCap, earliestSprint),
  }))

  // Prefer devs who can fully complete the work; among those, pick most capacity; else most capacity
  withTotals.sort((a, b) => {
    const ac = a.total >= capacityNeeded, bc = b.total >= capacityNeeded
    if (ac !== bc) return ac ? -1 : 1
    return b.total - a.total
  })

  const chosen = withTotals[0]?.dev
  if (!chosen) return { startSprint: null, endSprint: null, unscheduled: capacityNeeded, devNames: [] }

  return allocateOneDev(chosen, projectId, capacityNeeded, mutableCap, origCap, timelines, earliestSprint, preworkFraction)
}

// Manual override with 2+ devs: old multi-dev greedy fill (devs work in parallel on same project)
function multiDevFill(
  projectId: string,
  capacityNeeded: number,
  eligibleDevs: Dev[],
  mutableCap: Record<string, Record<number, number>>,
  origCap: Record<string, Record<number, number>>,
  timelines: Record<string, DevTimeline>,
  earliestSprint: number,
  preworkFraction?: number,
): FillResult {
  if (capacityNeeded <= 0) return { startSprint: null, endSprint: null, unscheduled: 0, devNames: [] }
  if (eligibleDevs.length === 0) return { startSprint: null, endSprint: null, unscheduled: capacityNeeded, devNames: [] }

  const sorted = [...eligibleDevs].sort((a, b) => totalAvail(b.name, mutableCap, earliestSprint) - totalAvail(a.name, mutableCap, earliestSprint))
  let remaining = capacityNeeded
  const usedDevs = new Set<string>()
  let startSprint: number | null = null
  let endSprint: number | null = null
  let be60Sprint: number | null = null
  let cumAllocated = 0

  for (const sp of PLANNING_SPRINTS) {
    if (sp < earliestSprint) continue
    if (remaining <= 0.001) break

    for (const dev of sorted) {
      if (remaining <= 0.001) break
      const avail = mutableCap[dev.name]?.[sp] ?? 0
      if (avail <= 0.001) continue

      const toUse = Math.min(avail, remaining)
      const orig = origCap[dev.name]?.[sp] ?? avail
      const fraction = orig > 0 ? Math.min(1, toUse / orig) : 1

      mutableCap[dev.name][sp] = Math.max(0, avail - toUse)
      remaining -= toUse
      cumAllocated += toUse

      timelines[dev.name].sprints[sp] = [
        ...(timelines[dev.name].sprints[sp] ?? []),
        { projectId, fraction, sprintsUsed: toUse } satisfies SprintBlock,
      ]

      usedDevs.add(dev.name)
      if (startSprint === null || sp < startSprint) startSprint = sp
      if (endSprint === null || sp > endSprint) endSprint = sp

      if (preworkFraction !== undefined && be60Sprint === null && cumAllocated >= preworkFraction * capacityNeeded) {
        be60Sprint = sp
      }
    }
  }

  return {
    startSprint,
    endSprint,
    be60Sprint: preworkFraction !== undefined ? be60Sprint : undefined,
    unscheduled: Math.max(0, remaining),
    devNames: [...usedDevs],
  }
}

function greedyFill(
  projectId: string,
  capacityNeeded: number,
  eligibleDevs: Dev[],
  mutableCap: Record<string, Record<number, number>>,
  origCap: Record<string, Record<number, number>>,
  timelines: Record<string, DevTimeline>,
  earliestSprint: number,
  preworkFraction?: number,
  manualCount = 0,
): FillResult {
  if (manualCount > 1) {
    return multiDevFill(projectId, capacityNeeded, eligibleDevs, mutableCap, origCap, timelines, earliestSprint, preworkFraction)
  }
  return singleDevFill(projectId, capacityNeeded, eligibleDevs, mutableCap, origCap, timelines, earliestSprint, preworkFraction)
}

// ── Main scheduler ────────────────────────────────────────────────────────────
export function scheduleAll(
  projects: Project[],
  devs: Dev[],
  devAssignments: Record<string, DevAssignment>,
  devOwnerMappings: Record<string, OwnerType[]>,
  devSprintOverrides: Record<string, Record<number, number>>,
  bePreworkPct: Record<string, number>,   // 0–100, default 60
): ScheduleResult {
  // Build capacity tables
  const origCap: Record<string, Record<number, number>> = {}
  const mutableCap: Record<string, Record<number, number>> = {}
  const timelines: Record<string, DevTimeline> = {}

  for (const dev of devs) {
    origCap[dev.name] = buildSprintCapMap(dev, devSprintOverrides[dev.name] ?? {})
    mutableCap[dev.name] = { ...origCap[dev.name] }
    timelines[dev.name] = {
      devName: dev.name,
      team: dev.team,
      perSprintCapacity: perSprintCapacity(dev.totalSprints),
      sprintCapacity: origCap[dev.name],
      sprints: { 3: [], 4: [], 5: [], 6: [] },
    }
  }

  // Effective owner mapping
  const effectiveOwners = (devName: string): OwnerType[] =>
    devOwnerMappings[devName] ?? devs.find(d => d.name === devName)?.owners ?? []

  const getEligible = (team: TeamType, owner: OwnerType, manual: string[]): Dev[] => {
    if (manual.length > 0) return devs.filter(d => d.team === team && manual.includes(d.name))
    return devs.filter(
      d => d.team === team &&
        effectiveOwners(d.name).includes(owner) &&
        PLANNING_SPRINTS.some(s => (mutableCap[d.name]?.[s] ?? 0) > 0),
    )
  }

  // Sort: priority ASC (p0 first), then ticket-ready sprint ASC, then WIP before Todo
  const statusOrd: Record<string, number> = { WIP: 0, QA: 0, Completed: 0, 'In Design': 1, Todo: 2, Stopped: 3, Blocked: 3 }
  const priorityOrd: Record<string, number> = { p0: 0, p1: 1, p2: 2 }
  const active = projects.filter(p => p.status !== 'Deprioritized' && p.status !== 'Done')
  active.sort((a, b) => {
    const pa = priorityOrd[a.priority ?? 'p0'], pb = priorityOrd[b.priority ?? 'p0']
    if (pa !== pb) return pa - pb
    const sa = dateToSprint(a.ticketReadyDate), sb = dateToSprint(b.ticketReadyDate)
    if (sa !== sb) return sa - sb
    return (statusOrd[a.status] ?? 2) - (statusOrd[b.status] ?? 2)
  })

  const projectSchedules: Record<string, ProjectScheduleResult> = {}

  for (const p of active) {
    const earliest = dateToSprint(p.ticketReadyDate)
    const asgn = devAssignments[p.id]
    const preworkPct = bePreworkPct[p.id] ?? 60   // 0–100
    const preworkFraction = preworkPct / 100       // 0.0–1.0

    // ── BE ──
    const manualBe = asgn?.beDevs ?? []
    const beDevs = getEligible('BE', p.owner, manualBe)
    const be = greedyFill(p.id, p.capacity.be, beDevs, mutableCap, origCap, timelines, earliest, preworkFraction, manualBe.length)

    // ── Prework dependency ──
    // FE/APP start the sprint AFTER bePreworkSprint (unless prework = 0 or no BE capacity)
    const bePreworkSp = be.be60Sprint ?? be.startSprint ?? earliest
    const feAppEarliest = (preworkPct === 0 || p.capacity.be === 0)
      ? earliest
      : Math.max(earliest, bePreworkSp + 1)

    // ── APP ──
    const manualApp = asgn?.appDevs ?? []
    const appDevs = getEligible('APP', p.owner, manualApp)
    const app = greedyFill(p.id, p.capacity.app, appDevs, mutableCap, origCap, timelines, feAppEarliest, undefined, manualApp.length)

    // ── FE ──
    const manualFe = asgn?.feDevs ?? []
    const feDevs = getEligible('FE', p.owner, manualFe)
    const fe = greedyFill(p.id, p.capacity.fe, feDevs, mutableCap, origCap, timelines, feAppEarliest, undefined, manualFe.length)

    const ends = [be.endSprint, app.endSprint, fe.endSprint].filter((x): x is number => x !== null)
    const starts = [be.startSprint, app.startSprint, fe.startSprint].filter((x): x is number => x !== null)

    const overallStart = starts.length ? Math.min(...starts) : earliest
    const overallEnd = ends.length ? Math.max(...ends) : earliest
    const totalUnscheduled = be.unscheduled + app.unscheduled + fe.unscheduled

    projectSchedules[p.id] = {
      projectId: p.id,
      beStart: be.startSprint, beEnd: be.endSprint, be60Sprint: be.be60Sprint ?? null,
      appStart: app.startSprint, appEnd: app.endSprint,
      feStart: fe.startSprint, feEnd: fe.endSprint,
      overallStart, overallEnd,
      isAtRisk: overallEnd > 6 || totalUnscheduled > 0.05,
      assignedDevs: { be: be.devNames, app: app.devNames, fe: fe.devNames },
      unscheduled: { be: be.unscheduled, app: app.unscheduled, fe: fe.unscheduled },
    }
  }

  // Inactive projects get a placeholder
  for (const p of projects) {
    if (p.status === 'Deprioritized' || p.status === 'Done') {
      projectSchedules[p.id] ??= {
        projectId: p.id,
        beStart: null, beEnd: null, be60Sprint: null,
        appStart: null, appEnd: null, feStart: null, feEnd: null,
        overallStart: 3, overallEnd: 3,
        isAtRisk: false,
        assignedDevs: { be: [], app: [], fe: [] },
        unscheduled: { be: 0, app: 0, fe: 0 },
      }
    }
  }

  return { projectSchedules, devTimelines: timelines }
}
