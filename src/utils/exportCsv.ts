import type { Project, ScheduleResult, ProjectScheduleResult } from '../types'
import { SPRINT_STARTS } from './scheduling'

const POD_NAME = 'Audience'
const DELIVERY_OWNER = 'Abhinav Gazta'
const JFM_CAPACITY = 0.65

// Yusuf can do 0.2sp/sprint × 4 sprints = 0.8sp total QA across OND
const YUSUF_BUDGET = 0.2 * 4

function sprintEndMs(sprint: number): number {
  return SPRINT_STARTS[3] + (sprint - 3) * 14 * 86400000 + 13 * 86400000
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function fmtQuarter(d: Date): string {
  const m = d.getMonth() + 1
  if (m >= 10) return 'OND'
  if (m <= 3)  return 'JFM'
  if (m <= 6)  return 'AMJ'
  return 'JAS'
}

function fmt2(n: number): string {
  return n === 0 ? '0' : String(Math.round(n * 100) / 100)
}

// ── QA allocation ──────────────────────────────────────────────────────────────
// Dolly and Gopal Pandey: load-balanced 50-50 by QA-sp
// Yusuf (0.2sp/sprint, 0.8sp total): assigned to smallest-QA projects first
function buildQAAssignments(
  items: Array<{ id: string; qa: number }>
): Record<string, string> {
  // Load-balance Dolly vs Gopal: assign highest-QA projects, always pick lighter load
  const sorted = [...items].sort((a, b) => b.qa - a.qa)
  let dollyLoad = 0, gopalLoad = 0
  const primary: Record<string, string> = {}
  for (const { id, qa } of sorted) {
    if (dollyLoad <= gopalLoad) { primary[id] = 'Dolly'; dollyLoad += qa }
    else                        { primary[id] = 'Gopal Pandey'; gopalLoad += qa }
  }

  // Assign Yusuf to smallest-QA projects until his 0.8sp budget runs out
  const withYusuf = new Set<string>()
  let yusufLeft = YUSUF_BUDGET
  for (const { id, qa } of [...items].sort((a, b) => a.qa - b.qa)) {
    if (yusufLeft <= 0.001) break
    if (qa <= yusufLeft + 0.001) { withYusuf.add(id); yusufLeft -= qa }
  }

  const result: Record<string, string> = {}
  for (const { id } of items) {
    result[id] = withYusuf.has(id) ? `${primary[id]}, Yusuf` : primary[id]
  }
  return result
}

// ── Done project data (user-provided) ─────────────────────────────────────────
interface DoneData {
  deliveryMonth: string; deliveryQuarter: string
  fe: number; app: number; be: number
  feDevs: string[]; beDevs: string[]
}

const DONE: Record<string, DoneData> = {
  p01: { deliveryMonth: 'October 2026',  deliveryQuarter: 'OND', fe: 1,    app: 1,    be: 1,   feDevs: ['Prakhar', 'Sahil'], beDevs: ['Divyansh'] },
  p05: { deliveryMonth: 'November 2026', deliveryQuarter: 'OND', fe: 0.25, app: 0.25, be: 0.5, feDevs: ['Vansh', 'Sahil'],  beDevs: ['Joel'] },
  p06: { deliveryMonth: 'November 2026', deliveryQuarter: 'OND', fe: 1,    app: 1,    be: 0,   feDevs: ['Vansh', 'Sahil'],  beDevs: [] },
  p19: { deliveryMonth: 'November 2026', deliveryQuarter: 'OND', fe: 0,    app: 1,    be: 0,   feDevs: ['Sahil'],           beDevs: [] },
  p22: { deliveryMonth: 'November 2026', deliveryQuarter: 'OND', fe: 0,    app: 0.25, be: 0,   feDevs: ['Rohit'],           beDevs: [] },
  p25: { deliveryMonth: 'November 2026', deliveryQuarter: 'OND', fe: 0.25, app: 0,    be: 0,   feDevs: ['Prakhar'],         beDevs: [] },
}

function computeDelivery(sched: ProjectScheduleResult) {
  const totalUnscheduled = sched.unscheduled.be + sched.unscheduled.app + sched.unscheduled.fe
  const extraSprints = totalUnscheduled > 0.001 ? Math.ceil(totalUnscheduled / JFM_CAPACITY) : 0
  const noPick = sched.assignedDevs.be.length === 0 &&
                 sched.assignedDevs.fe.length === 0 &&
                 sched.assignedDevs.app.length === 0
  const devEnd   = Math.max(sched.overallEnd, extraSprints > 0 ? 6 : sched.overallEnd) + extraSprints
  const devStart = noPick ? 7 : sched.overallStart
  const devDurationDays = Math.max(1, devEnd - devStart + 1) * 14
  const qaDays = Math.round(devDurationDays * 0.25)
  const deliveryDate = new Date(sprintEndMs(devEnd) + qaDays * 86400000)
  return { deliveryMonth: fmtMonth(deliveryDate), deliveryQuarter: fmtQuarter(deliveryDate) }
}

function csvRow(cells: string[]): string {
  return cells.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
}

export function generateCSV(projects: Project[], scheduleResult: ScheduleResult): string {
  const { projectSchedules } = scheduleResult

  // Build QA # for every non-deprioritized project (for allocation)
  const qaItems: Array<{ id: string; qa: number }> = []
  for (const p of projects) {
    if (p.status === 'Deprioritized') continue
    if (p.status === 'Done') {
      const d = DONE[p.id]
      if (d) qaItems.push({ id: p.id, qa: (d.fe + d.app + d.be) * 0.2 })
    } else {
      qaItems.push({ id: p.id, qa: (p.capacity.fe + p.capacity.app + p.capacity.be) * 0.2 })
    }
  }
  const qaAssign = buildQAAssignments(qaItems)

  const lines: string[] = [csvRow([
    'Project / deliverable', 'POD Name', 'Delivery owner',
    'Delivery Month', 'Delivery Quarter',
    'Front-end #', 'Back-end #', 'QA #',
    'FE', 'BE', 'QA',
  ])]

  for (const p of projects) {
    const name = p.roadmapItem

    if (p.status === 'Deprioritized') {
      lines.push(csvRow([name, POD_NAME, DELIVERY_OWNER, 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA']))
      continue
    }

    if (p.status === 'Done') {
      const d = DONE[p.id]
      if (!d) { lines.push(csvRow([name, POD_NAME, DELIVERY_OWNER, 'TBD', 'OND', '0', '0', '0', '', '', ''])); continue }
      lines.push(csvRow([
        name, POD_NAME, DELIVERY_OWNER,
        d.deliveryMonth, d.deliveryQuarter,
        fmt2(d.fe + d.app), fmt2(d.be), fmt2((d.fe + d.app + d.be) * 0.2),
        d.feDevs.join(', '), d.beDevs.join(', '),
        qaAssign[p.id] ?? '',
      ]))
      continue
    }

    const sched = projectSchedules[p.id]
    if (!sched) { lines.push(csvRow([name, POD_NAME, DELIVERY_OWNER, 'TBD', 'TBD', '', '', '', '', '', ''])); continue }

    const { deliveryMonth, deliveryQuarter } = computeDelivery(sched)
    lines.push(csvRow([
      name, POD_NAME, DELIVERY_OWNER,
      deliveryMonth, deliveryQuarter,
      fmt2(p.capacity.fe + p.capacity.app),
      fmt2(p.capacity.be),
      fmt2((p.capacity.fe + p.capacity.app + p.capacity.be) * 0.2),
      [...sched.assignedDevs.fe, ...sched.assignedDevs.app].join(', '),
      sched.assignedDevs.be.join(', '),
      qaAssign[p.id] ?? '',
    ]))
  }

  return lines.join('\n')
}
