import React, { useState, useMemo } from 'react'
import type { Project, ScheduleResult, PriorityType, StatusType } from '../types/index'
import type { State, Action } from '../hooks/useAppState'
import { projectColor } from '../utils/scheduling'

interface Props {
  projects: Project[]
  scheduleResult: ScheduleResult
  projectIndex: Record<string, number>
  state: State
  dispatch: React.Dispatch<Action>
}

const OWNER_COLORS: Record<string, string> = {
  GC: '#f59e0b',
  Atul: '#06b6d4',
  Swastik: '#8b5cf6',
  Bikash: '#f97316',
  Atinder: '#10b981',
}

const PRIORITY_GROUPS = [
  { key: 'p0', label: 'P0 — Must have', accent: 'text-red-400', headerBg: 'bg-red-900/20' },
  { key: 'p1', label: 'P1 — Should have', accent: 'text-amber-400', headerBg: 'bg-amber-900/20' },
  { key: 'p2', label: 'P2 — Nice to have', accent: 'text-slate-400', headerBg: 'bg-slate-800/60' },
] as const

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'WIP': return 'bg-blue-500/20 text-blue-300'
    case 'QA': return 'bg-cyan-500/20 text-cyan-300'
    case 'In Design': return 'bg-purple-500/20 text-purple-300'
    case 'Todo': return 'bg-slate-500/20 text-slate-300'
    case 'Completed': return 'bg-emerald-500/20 text-emerald-300'
    case 'Done': return 'bg-green-500/20 text-green-400'
    case 'Stopped': return 'bg-orange-500/20 text-orange-300'
    case 'Blocked': return 'bg-red-500/20 text-red-300'
    case 'Deprioritized': return 'bg-slate-700/40 text-slate-500'
    default: return 'bg-slate-500/20 text-slate-300'
  }
}


interface CardProps {
  project: Project
  schedule: ScheduleResult['projectSchedules'][string] | undefined
  colorIndex: number
  isSelected: boolean
  dimmed?: boolean
  onSelect: () => void
}

const ProjectCard: React.FC<CardProps> = ({ project, schedule, colorIndex, isSelected, dimmed, onSelect }) => {
  const color = projectColor(colorIndex)
  const sched = schedule

  return (
    <div
      className={`relative flex cursor-pointer px-2 py-2 transition-colors border-l-2 ${
        isSelected ? 'bg-slate-700/60' : 'border-l-transparent hover:bg-slate-800/40'
      } ${dimmed ? 'opacity-40' : ''}`}
      style={isSelected ? { borderLeftColor: color } : {}}
      onClick={onSelect}
    >
      {/* Colored bar */}
      <div className="mt-0.5 mr-2 flex-shrink-0 rounded-full" style={{ width: 3, minHeight: 36, backgroundColor: color }} />

      <div className="min-w-0 flex-1">
        {/* Badges row */}
        <div className="mb-0.5 flex items-center gap-1 flex-wrap">
          <span className={`inline-block rounded px-1 py-0 text-[9px] font-semibold leading-4 ${statusBadgeClass(project.status)}`}>
            {project.status}
          </span>
          <span
            className="inline-block rounded px-1 py-0 text-[9px] font-semibold leading-4"
            style={{
              backgroundColor: (OWNER_COLORS[project.owner] ?? '#94a3b8') + '30',
              color: OWNER_COLORS[project.owner] ?? '#94a3b8',
            }}
          >
            {project.owner}
          </span>
        </div>

        {/* Name */}
        <p className="line-clamp-2 text-xs font-medium leading-tight text-slate-100">
          <span className="text-slate-500 font-mono text-[9px] mr-1">[{project.id}]</span>
          {project.roadmapItem}
        </p>

        {sched?.isAtRisk && (
          <span className="inline-block rounded bg-red-500/20 px-1 py-0 text-[9px] font-bold leading-4 text-red-400 mt-0.5">
            ⚠ AT RISK
          </span>
        )}
      </div>
    </div>
  )
}

function matchesFilters(
  p: Project,
  sched: ScheduleResult['projectSchedules'][string] | undefined,
  state: State,
): boolean {
  if (state.filterOwner.length > 0 && !state.filterOwner.includes(p.owner)) return false
  if (state.filterStatus.length > 0 && !state.filterStatus.includes(p.status)) return false
  if (state.filterPriority.length > 0 && !state.filterPriority.includes(p.priority ?? 'p0')) return false
  if (state.filterDev.length > 0) {
    const devs = sched ? [...sched.assignedDevs.be, ...sched.assignedDevs.app, ...sched.assignedDevs.fe] : []
    if (!state.filterDev.some(f => devs.includes(f))) return false
  }
  return true
}

function StoppedSection({ projects, scheduleResult, projectIndex, selectedProjectId, isFiltered, matchSet, onSelect }: {
  projects: Project[]
  scheduleResult: ScheduleResult
  projectIndex: Record<string, number>
  selectedProjectId: string | null
  isFiltered: boolean
  matchSet: Set<string>
  onSelect: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  return (
    <div className="mt-1 border-t border-slate-700/50">
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left bg-orange-900/20 hover:brightness-110 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <svg className={`h-3 w-3 flex-shrink-0 text-orange-400/60 transition-transform ${collapsed ? '-rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-orange-400/80">Stopped</span>
        <span className="text-[9px] text-orange-400/40 ml-0 font-normal normal-case tracking-normal">takes bandwidth</span>
        <span className="ml-auto rounded-full bg-orange-900/40 px-1.5 py-0 text-[10px] text-orange-400/70">
          {projects.length}
        </span>
      </button>
      {!collapsed && projects.map(p => (
        <ProjectCard
          key={p.id}
          project={p}
          schedule={scheduleResult.projectSchedules[p.id]}
          colorIndex={projectIndex[p.id] ?? 0}
          isSelected={selectedProjectId === p.id}
          dimmed={isFiltered && !matchSet.has(p.id)}
          onSelect={() => onSelect(p.id)}
        />
      ))}
    </div>
  )
}

const BLANK_FORM = { name: '', owner: '', businessLine: 'Platform', priority: 'p0' as PriorityType }

const ProjectList: React.FC<Props> = ({ projects, scheduleResult, projectIndex, state, dispatch }) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [deprioritizedCollapsed, setDeprioritizedCollapsed] = useState(true)
  const [addingProject, setAddingProject] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)

  function submitAdd() {
    const name = form.name.trim()
    if (!name) return
    const owner = (form.owner.trim() || state.ownerList[0]) as string
    const id = `custom_${Date.now()}`
    const project: Project = {
      id,
      businessLine: form.businessLine.trim() || 'Platform',
      roadmapItem: name,
      owner,
      quarter: "OND'26",
      ticketReadyDate: null,
      capacity: { be: 0, app: 0, fe: 0 },
      status: 'Todo' as StatusType,
      priority: form.priority,
    }
    dispatch({ type: 'ADD_PROJECT', project })
    setForm(BLANK_FORM)
    setAddingProject(false)
  }

  const isFiltered = state.filterOwner.length > 0 || state.filterStatus.length > 0 ||
    state.filterPriority.length > 0 || state.filterDev.length > 0

  const { active, stopped, deprioritized } = useMemo(() => {
    const active: Project[] = []
    const stopped: Project[] = []
    const deprioritized: Project[] = []

    for (const p of projects) {
      if (p.status === 'Deprioritized') { deprioritized.push(p); continue }
      if (p.status === 'Stopped') { stopped.push(p); continue }
      active.push(p)
    }

    // Sort by priority ord → overallStart → id
    const priorityOrd: Record<string, number> = { p0: 0, p1: 1, p2: 2 }
    const sortKey = (p: Project) => [
      priorityOrd[p.priority ?? 'p0'] ?? 0,
      scheduleResult.projectSchedules[p.id]?.overallStart ?? 99,
      p.id,
    ]
    active.sort((a, b) => {
      const ka = sortKey(a), kb = sortKey(b)
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] < kb[i]) return -1
        if (ka[i] > kb[i]) return 1
      }
      return 0
    })

    return { active, stopped, deprioritized }
  }, [projects, scheduleResult])

  // For each active project, determine if it matches current filters
  const matchSet = useMemo(() => new Set(
    active
      .filter(p => matchesFilters(p, scheduleResult.projectSchedules[p.id], state))
      .map(p => p.id)
  ), [active, scheduleResult, state])

  const handleSelectProject = (id: string) => {
    dispatch({ type: 'SELECT_PROJECT', id: state.selectedProjectId === id ? null : id })
  }

  const totalActive = active.length
  const matchCount = matchSet.size

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900">
      {/* Summary header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/60 flex-shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Projects</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">
            {isFiltered ? `${matchCount} / ${totalActive}` : totalActive}
          </span>
          <button
            onClick={() => { setAddingProject(v => !v); setForm(BLANK_FORM) }}
            className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-700/60 rounded px-1.5 py-0.5 transition-colors leading-none">
            {addingProject ? '✕' : '+ New'}
          </button>
        </div>
      </div>

      {/* Inline new-project form */}
      {addingProject && (
        <div className="px-3 py-2.5 border-b border-slate-700/60 bg-slate-800/60 space-y-2 flex-shrink-0">
          <input
            autoFocus
            type="text" placeholder="Project name *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setAddingProject(false) }}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-1.5">
            <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
              className="flex-1 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500">
              <option value="">Owner…</option>
              {state.ownerList.map(o => <option key={o}>{o}</option>)}
            </select>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as PriorityType }))}
              className="w-16 bg-slate-700 border border-slate-600 rounded px-1.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500">
              <option value="p0">p0</option>
              <option value="p1">p1</option>
              <option value="p2">p2</option>
            </select>
          </div>
          <input
            type="text" placeholder="Business line (e.g. Platform)"
            value={form.businessLine}
            onChange={e => setForm(f => ({ ...f, businessLine: e.target.value }))}
            className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-1.5">
            <button onClick={submitAdd} disabled={!form.name.trim()}
              className="flex-1 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs text-white transition-colors">
              Add project
            </button>
            <button onClick={() => setAddingProject(false)}
              className="px-3 py-1 rounded text-xs text-slate-400 hover:text-slate-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Priority groups */}
        {PRIORITY_GROUPS.map(({ key, label, accent, headerBg }) => {
          const groupProjects = active.filter(p => (p.priority ?? 'p0') === key)
          if (groupProjects.length === 0) return null
          const isCollapsed = !!collapsedGroups[key]
          const groupMatchCount = groupProjects.filter(p => matchSet.has(p.id)).length

          return (
            <div key={key}>
              <button
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${headerBg} hover:brightness-110`}
                onClick={() => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))}
              >
                <svg
                  className={`h-3 w-3 flex-shrink-0 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className={`text-[11px] font-bold uppercase tracking-widest ${accent}`}>{label}</span>
                <span className="ml-auto rounded-full bg-slate-700/80 px-1.5 py-0 text-[10px] text-slate-300">
                  {isFiltered ? `${groupMatchCount}/${groupProjects.length}` : groupProjects.length}
                </span>
              </button>

              {!isCollapsed && groupProjects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  schedule={scheduleResult.projectSchedules[p.id]}
                  colorIndex={projectIndex[p.id] ?? 0}
                  isSelected={state.selectedProjectId === p.id}
                  dimmed={isFiltered && !matchSet.has(p.id)}
                  onSelect={() => handleSelectProject(p.id)}
                />
              ))}
            </div>
          )
        })}

        {/* Stopped (took bandwidth, stopped mid-quarter) */}
        {stopped.length > 0 && (
          <StoppedSection
            projects={stopped}
            scheduleResult={scheduleResult}
            projectIndex={projectIndex}
            selectedProjectId={state.selectedProjectId}
            isFiltered={isFiltered}
            matchSet={matchSet}
            onSelect={handleSelectProject}
          />
        )}

        {/* Deprioritized */}
        {deprioritized.length > 0 && (
          <div className="mt-1 border-t border-slate-700/50">
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left bg-slate-800/60 hover:brightness-110 transition-colors"
              onClick={() => setDeprioritizedCollapsed(p => !p)}
            >
              <svg
                className={`h-3 w-3 flex-shrink-0 text-slate-500 transition-transform ${deprioritizedCollapsed ? '-rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Deprioritized</span>
              <span className="ml-auto rounded-full bg-slate-800 px-1.5 py-0 text-[10px] text-slate-500">
                {deprioritized.length}
              </span>
            </button>
            {!deprioritizedCollapsed && deprioritized.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                schedule={scheduleResult.projectSchedules[p.id]}
                colorIndex={projectIndex[p.id] ?? 0}
                isSelected={state.selectedProjectId === p.id}
                dimmed
                onSelect={() => handleSelectProject(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectList
