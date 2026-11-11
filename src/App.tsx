import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useAppState } from './hooks/useAppState'
import { scheduleAll, dateToSprint, SPRINT_STARTS } from './utils/scheduling'
import ProjectList from './components/ProjectList'
import { DevGanttChart } from './components/DevGanttChart'
import { ProjectEditor } from './components/ProjectEditor'
import { DevMappingModal } from './components/DevMappingModal'
import { AtRiskModal } from './components/AtRiskModal'
import { ScenarioPanel, DEFAULT_SCENARIO } from './components/ScenarioPanel'
import type { ScenarioConfig } from './components/ScenarioPanel'
import type { Dev, TeamType, OwnerType } from './types'
import { generateCSV } from './utils/exportCsv'

const STATUSES_OPTS = ['WIP', 'QA', 'In Design', 'Todo', 'Completed', 'Done', 'Stopped', 'Blocked']
const PRIORITIES_OPTS = ['p0', 'p1', 'p2']


function MultiSelect({ label, options, value, onChange }: {
  label: string
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }

  const display = value.length === 0 ? 'All' : value.length === 1 ? value[0] : `${value.length} selected`

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-slate-400">{label}</label>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs focus:outline-none flex items-center gap-1.5 min-w-[72px] hover:border-slate-500 transition-colors"
        >
          <span className={value.length === 0 ? 'text-slate-400' : 'text-slate-100'}>{display}</span>
          <svg className="h-2.5 w-2.5 text-slate-400 flex-shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-0.5 left-0 bg-slate-800 border border-slate-600 rounded shadow-xl min-w-max">
            <label className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-700 cursor-pointer text-xs text-slate-300 border-b border-slate-700">
              <input type="checkbox" checked={value.length === 0} onChange={() => onChange([])} className="accent-blue-500" />
              All
            </label>
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-700 cursor-pointer text-xs text-slate-200">
                <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)} className="accent-blue-500" />
                {opt}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const { state, dispatch } = useAppState()
  const [showAtRisk, setShowAtRisk] = useState(false)
  const [scenario, setScenario] = useState<ScenarioConfig>(DEFAULT_SCENARIO)

  const PROJECT_INDEX = useMemo(
    () => Object.fromEntries(state.projects.map((p, i) => [p.id, i])),
    [state.projects],
  )

  const devs = useMemo(
    () => state.devList.map(d => ({ ...d, owners: state.devOwnerMappings[d.name] ?? d.owners })),
    [state.devList, state.devOwnerMappings],
  )

  // ── Scenario: ticket date shift ───────────────────────────────────────────
  const simulatedProjects = useMemo(() => {
    const { active, scope, sprints } = scenario.ticketShift
    if (!active) return state.projects
    return state.projects.map(p => {
      const sp = dateToSprint(p.ticketReadyDate)
      if (scope === 'late' && sp < 5) return p
      if (sp <= 3) return p
      const newSp = Math.max(3, sp - sprints)
      if (newSp === sp) return p
      return { ...p, ticketReadyDate: new Date(SPRINT_STARTS[newSp]).toISOString().slice(0, 10) }
    })
  }, [state.projects, scenario.ticketShift])

  // ── Scenario: extra devs ──────────────────────────────────────────────────
  const simulatedDevs = useMemo((): Dev[] => {
    const { active, devs: extraList } = scenario.extraDevs
    if (!active || extraList.length === 0) return devs
    const skillCounts: Record<string, number> = {}
    const extras: Dev[] = extraList.map(({ skill, capacity }) => {
      skillCounts[skill] = (skillCounts[skill] ?? 0) + 1
      return {
        name: `+${skill}${skillCounts[skill]}`,
        team: skill as TeamType,
        totalSprints: capacity * 36 / 5,  // perSprintCapacity(totalSprints) = capacity
        owners: state.ownerList as OwnerType[],
      }
    })
    return [...devs, ...extras]
  }, [devs, scenario.extraDevs, state.ownerList])

  const simulatedOverrides = useMemo(() => {
    const { active, devs: extraList } = scenario.extraDevs
    if (!active || extraList.length === 0) return state.devSprintOverrides
    const overrides = { ...state.devSprintOverrides }
    const skillCounts: Record<string, number> = {}
    extraList.forEach(({ skill, capacity, fromSprint }) => {
      skillCounts[skill] = (skillCounts[skill] ?? 0) + 1
      const name = `+${skill}${skillCounts[skill]}`
      // 4.5 = second half of S4 (half capacity in S4, full from S5)
      // 5   = available from S5 (S3/S4 = 0)
      // 6   = available from S6 (S3/S4/S5 = 0)
      const sprintOverride: Record<number, number> =
        fromSprint === 4.5 ? { 3: 0, 4: capacity / 2 } :
        fromSprint === 5   ? { 3: 0, 4: 0 } :
                             { 3: 0, 4: 0, 5: 0 }
      overrides[name] = sprintOverride
    })
    return overrides
  }, [state.devSprintOverrides, scenario.extraDevs])

  // ── Scheduler ─────────────────────────────────────────────────────────────
  const scheduleResult = useMemo(
    () => scheduleAll(
      simulatedProjects,
      simulatedDevs,
      state.devAssignments,
      state.devOwnerMappings,
      simulatedOverrides,
      state.bePreworkPct,
    ),
    [simulatedProjects, simulatedDevs, state.devAssignments, state.devOwnerMappings, simulatedOverrides, state.bePreworkPct],
  )

  const selectedProject = state.selectedProjectId
    ? state.projects.find(p => p.id === state.selectedProjectId) ?? null
    : null

  const atRiskCount = Object.values(scheduleResult.projectSchedules)
    .filter(s => s.isAtRisk).length

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 border-b border-slate-700 flex-shrink-0 flex-wrap">
        <h1 className="text-sm font-bold text-white tracking-tight">Sprint Gantt</h1>
        <span className="text-xs text-slate-500">OND'26 · S3–S6</span>

        <MultiSelect
          label="Owner"
          options={state.ownerList}
          value={state.filterOwner}
          onChange={v => dispatch({ type: 'SET_FILTER_OWNER', value: v })}
        />

        <MultiSelect
          label="Status"
          options={STATUSES_OPTS}
          value={state.filterStatus}
          onChange={v => dispatch({ type: 'SET_FILTER_STATUS', value: v })}
        />

        <MultiSelect
          label="Priority"
          options={PRIORITIES_OPTS}
          value={state.filterPriority}
          onChange={v => dispatch({ type: 'SET_FILTER_PRIORITY', value: v })}
        />

        <MultiSelect
          label="Dev"
          options={state.devList.map(d => d.name)}
          value={state.filterDev}
          onChange={v => dispatch({ type: 'SET_FILTER_DEV', value: v })}
        />

        <div className="ml-auto flex items-center gap-2">
          {atRiskCount > 0 && (
            <button
              onClick={() => setShowAtRisk(true)}
              className="text-[11px] font-semibold text-red-400 bg-red-900/30 border border-red-800/50 rounded px-2 py-0.5 hover:bg-red-900/50 hover:border-red-700 transition-colors cursor-pointer"
            >
              ⚠ {atRiskCount} at risk
            </button>
          )}
          <ScenarioPanel scenario={scenario} onChange={setScenario} />
          <button onClick={() => dispatch({ type: 'TOGGLE_DEV_MAPPING' })}
            className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-300 hover:border-slate-400 transition-colors">
            Dev Settings
          </button>
          <button
            onClick={() => {
              const csv = generateCSV(simulatedProjects, scheduleResult)
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `ond26-delivery-${new Date().toISOString().slice(0,10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-xs px-3 py-1 rounded border border-emerald-700 text-emerald-400 hover:border-emerald-500 hover:text-emerald-300 transition-colors"
            title="Export delivery plan as CSV">
            Export CSV
          </button>
          <button
            onClick={() => {
              const raw = localStorage.getItem('gantt_state_v4')
              if (!raw) return
              const blob = new Blob([raw], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `gantt-state-${new Date().toISOString().slice(0,10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors"
            title="Export current state as JSON">
            Export
          </button>
          <label
            className="text-xs px-3 py-1 rounded border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title="Import a previously exported state JSON">
            Import
            <input type="file" accept=".json" className="hidden" onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = ev => {
                try {
                  const data = JSON.parse(ev.target?.result as string)
                  localStorage.setItem('gantt_state_v4', JSON.stringify(data))
                  window.location.reload()
                } catch { alert('Invalid state file') }
              }
              reader.readAsText(file)
              e.target.value = ''
            }} />
          </label>
          <button
            onClick={() => { if (window.confirm('Reset all edits?')) dispatch({ type: 'RESET' }) }}
            className="text-xs px-3 py-1 rounded border border-slate-700 text-slate-500 hover:border-red-700 hover:text-red-400 transition-colors">
            Reset
          </button>
        </div>
      </header>

      {/* ── Main 3-panel layout ── */}
      <div className="flex flex-1 overflow-hidden">

        <div className="w-72 flex-shrink-0 border-r border-slate-700 overflow-y-auto">
          <ProjectList
            projects={simulatedProjects}
            scheduleResult={scheduleResult}
            projectIndex={PROJECT_INDEX}
            state={state}
            dispatch={dispatch}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <DevGanttChart
            projects={simulatedProjects}
            devs={simulatedDevs}
            scheduleResult={scheduleResult}
            projectIndex={PROJECT_INDEX}
            state={state}
            dispatch={dispatch}
          />
        </div>

        {selectedProject && (
          <div className="w-72 flex-shrink-0 border-l border-slate-700 bg-slate-800/80 overflow-hidden">
            <ProjectEditor
              project={selectedProject}
              schedule={scheduleResult.projectSchedules[selectedProject.id]}
              state={state}
              dispatch={dispatch}
            />
          </div>
        )}
      </div>

      {state.showDevMapping && (
        <DevMappingModal state={state} dispatch={dispatch} />
      )}

      {showAtRisk && (
        <AtRiskModal
          projects={simulatedProjects}
          scheduleResult={scheduleResult}
          devList={simulatedDevs}
          onClose={() => setShowAtRisk(false)}
        />
      )}
    </div>
  )
}
