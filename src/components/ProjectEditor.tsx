import React from 'react'
import type { Project, StatusType, PriorityType } from '../types'
import type { State, Action } from '../hooks/useAppState'
import type { ProjectScheduleResult } from '../types'

const STATUSES: StatusType[] = ['WIP', 'QA', 'In Design', 'Todo', 'Completed', 'Done', 'Stopped', 'Blocked', 'Deprioritized']
const PRIORITIES: { value: PriorityType; label: string }[] = [
  { value: 'p0', label: 'P0 — Must have' },
  { value: 'p1', label: 'P1 — Should have' },
  { value: 'p2', label: 'P2 — Nice to have' },
]

const SPRINT_LABELS: Record<number, string> = {
  3: 'S3 (Nov 9)', 4: 'S4 (Nov 23)', 5: 'S5 (Dec 7)', 6: 'S6 (Dec 21)',
}

interface Props {
  project: Project
  schedule: ProjectScheduleResult | undefined
  state: State
  dispatch: React.Dispatch<Action>
}

export function ProjectEditor({ project, schedule, state, dispatch }: Props) {
  const asgn = state.devAssignments[project.id] ?? {
    projectId: project.id, beDevs: [], appDevs: [], feDevs: [],
  }
  const preworkPct = state.bePreworkPct[project.id] ?? 60

  const update = (changes: Partial<Project>) =>
    dispatch({ type: 'UPDATE_PROJECT', id: project.id, changes })

  const setDevs = (team: 'beDevs' | 'appDevs' | 'feDevs', name: string, checked: boolean) => {
    const cur = asgn[team] ?? []
    dispatch({
      type: 'SET_DEV_ASSIGNMENT',
      assignment: {
        ...asgn,
        [team]: checked ? [...cur, name] : cur.filter(d => d !== name),
      },
    })
  }

  const beDevs = state.devList.filter(d => d.team === 'BE' && (state.devOwnerMappings[d.name] ?? d.owners).includes(project.owner))
  const appDevs = state.devList.filter(d => d.team === 'APP' && (state.devOwnerMappings[d.name] ?? d.owners).includes(project.owner))
  const feDevs = state.devList.filter(d => d.team === 'FE' && (state.devOwnerMappings[d.name] ?? d.owners).includes(project.owner))

  return (
    <div className="h-full overflow-y-auto text-sm flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 flex-shrink-0">
        <div className="flex justify-between items-start gap-2">
          <div>
            <h2 className="text-xs font-semibold text-slate-100 leading-snug">{project.roadmapItem}</h2>
            <div className="text-[10px] text-slate-400 mt-0.5">{project.businessLine}</div>
          </div>
          <button onClick={() => dispatch({ type: 'SELECT_PROJECT', id: null })}
            className="text-slate-400 hover:text-white text-lg leading-none flex-shrink-0">×</button>
        </div>

        {/* Schedule summary */}
        {schedule && (
          <div className={`mt-2 text-[10px] rounded px-2 py-1.5 ${schedule.isAtRisk ? 'bg-red-900/30 border border-red-700/50' : 'bg-slate-700/50'}`}>
            {schedule.isAtRisk ? (
              <span className="text-red-300 font-semibold">⚠ AT RISK — </span>
            ) : null}
            {schedule.overallStart <= 6
              ? `Sprints ${SPRINT_LABELS[schedule.overallStart]} → ${SPRINT_LABELS[Math.min(schedule.overallEnd, 6)]}`
              : 'No sprint assigned yet'}
            {schedule.unscheduled.be > 0 && <div className="text-red-400 mt-0.5">BE: {schedule.unscheduled.be}sp unscheduled</div>}
            {schedule.unscheduled.app > 0 && <div className="text-red-400">APP: {schedule.unscheduled.app}sp unscheduled</div>}
            {schedule.unscheduled.fe > 0 && <div className="text-red-400">FE: {schedule.unscheduled.fe}sp unscheduled</div>}
          </div>
        )}
      </div>

      <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1">
        {/* Priority + Status row */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Priority">
            <select value={project.priority ?? 'p0'}
              onChange={e => update({ priority: e.target.value as PriorityType })}
              className={`w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                (project.priority ?? 'p0') === 'p0' ? 'bg-red-900/30 border-red-700 text-red-200'
                : (project.priority ?? 'p0') === 'p1' ? 'bg-amber-900/30 border-amber-700 text-amber-200'
                : 'bg-slate-700 border-slate-600 text-slate-300'
              }`}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={project.status}
              onChange={e => update({ status: e.target.value as StatusType })}
              className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {/* Owner */}
        <Field label="Owner">
          <select value={project.owner}
            onChange={e => update({ owner: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {state.ownerList.map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>

        {/* Ticket ready date */}
        <Field label="Ticket Ready Date">
          <input type="date" value={project.ticketReadyDate ?? ''}
            onChange={e => update({ ticketReadyDate: e.target.value || null })}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {project.ticketReadyDate && (
            <button onClick={() => update({ ticketReadyDate: null })}
              className="mt-1 text-[10px] text-slate-400 hover:text-slate-200">
              Clear → starts Sprint 3
            </button>
          )}
        </Field>

        {/* Capacity */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
            Capacity (sprints)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['be', 'app', 'fe'] as const).map(t => (
              <div key={t}>
                <label className="text-[10px] text-slate-400 uppercase mb-1 block">{t}</label>
                <input type="number" min={0} step={0.5}
                  value={project.capacity[t]}
                  onChange={e => update({ capacity: { ...project.capacity, [t]: parseFloat(e.target.value) || 0 } })}
                  className={`w-full rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    project.capacity[t] === 0
                      ? 'bg-red-900/40 border border-red-600 text-red-300'
                      : 'bg-slate-700 border border-slate-600 text-slate-100'
                  }`} />
              </div>
            ))}
          </div>
        </div>

        {/* BE prework % */}
        {project.capacity.be > 0 && (
          <div className="bg-slate-700/40 rounded p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">BE prework required</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number" min={0} max={100} step={5}
                  value={preworkPct}
                  onChange={e => dispatch({ type: 'SET_PREWORK_PCT', projectId: project.id, value: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                  className="w-14 text-xs font-mono text-center rounded bg-slate-700 border border-slate-600 text-slate-100 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={preworkPct}
              onChange={e => dispatch({ type: 'SET_PREWORK_PCT', projectId: project.id, value: parseInt(e.target.value) })}
              className="w-full accent-blue-500"
            />
            <p className="text-[10px] text-slate-400">
              {preworkPct === 0
                ? 'FE/APP can start immediately alongside BE'
                : preworkPct === 100
                ? `FE/APP waits until BE is fully done${schedule?.be60Sprint ? ` (Sprint ${schedule.be60Sprint})` : ''}`
                : `FE/APP waits until ${preworkPct}% of BE is done${schedule?.be60Sprint ? ` → Sprint ${schedule.be60Sprint + 1}` : ''}`}
            </p>
          </div>
        )}

        {/* Dev Assignment */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
            Dev Assignment
          </label>
          <p className="text-[10px] text-slate-500 mb-2">
            Leave empty for auto-assignment based on owner mapping.
          </p>
          <DevPicker label="BE" devs={beDevs.map(d => d.name)} selected={asgn.beDevs}
            disabled={project.capacity.be === 0}
            onChange={(n, c) => setDevs('beDevs', n, c)} />
          <DevPicker label="APP" devs={appDevs.map(d => d.name)} selected={asgn.appDevs}
            disabled={project.capacity.app === 0}
            onChange={(n, c) => setDevs('appDevs', n, c)} />
          <DevPicker label="FE" devs={feDevs.map(d => d.name)} selected={asgn.feDevs}
            disabled={project.capacity.fe === 0}
            onChange={(n, c) => setDevs('feDevs', n, c)} />
        </div>

        {/* Assigned devs summary */}
        {schedule && (schedule.assignedDevs.be.length > 0 || schedule.assignedDevs.app.length > 0 || schedule.assignedDevs.fe.length > 0) && (
          <div className="text-[10px] text-slate-400 bg-slate-800 rounded p-2">
            <div className="font-semibold mb-1 text-slate-300">Auto-assigned:</div>
            {schedule.assignedDevs.be.length > 0 && <div>BE: {schedule.assignedDevs.be.join(', ')}</div>}
            {schedule.assignedDevs.app.length > 0 && <div>APP: {schedule.assignedDevs.app.join(', ')}</div>}
            {schedule.assignedDevs.fe.length > 0 && <div>FE: {schedule.assignedDevs.fe.join(', ')}</div>}
          </div>
        )}

        {/* Deprioritize */}
        {project.status !== 'Deprioritized' ? (
          <button onClick={() => update({ status: 'Deprioritized' })}
            className="w-full py-2 rounded text-xs font-semibold text-red-400 border border-red-800 hover:bg-red-900/30 transition-colors">
            Deprioritize (hide from chart)
          </button>
        ) : (
          <button onClick={() => update({ status: 'Todo' })}
            className="w-full py-2 rounded text-xs font-semibold text-green-400 border border-green-800 hover:bg-green-900/30 transition-colors">
            Re-activate project
          </button>
        )}

        {/* Delete project permanently */}
        <button
          onClick={() => {
            if (window.confirm(`Permanently delete "${project.roadmapItem}"? This cannot be undone.`)) {
              dispatch({ type: 'REMOVE_PROJECT', id: project.id })
            }
          }}
          className="w-full py-2 rounded text-xs font-semibold text-slate-500 border border-slate-700 hover:border-red-800 hover:text-red-500 transition-colors mt-1">
          Delete project
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

function DevPicker({ label, devs, selected, disabled, onChange }: {
  label: string; devs: string[]; selected: string[];
  disabled: boolean; onChange: (n: string, c: boolean) => void
}) {
  if (devs.length === 0) return null
  return (
    <div className="mb-2">
      <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {devs.map(name => {
          const on = selected.includes(name)
          return (
            <button key={name} disabled={disabled} onClick={() => onChange(name, !on)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                disabled ? 'opacity-30 cursor-not-allowed border-slate-700 text-slate-500'
                  : on ? 'bg-blue-600/40 border-blue-500 text-blue-200'
                  : 'border-slate-600 text-slate-400 hover:border-slate-400'
              }`}>
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
