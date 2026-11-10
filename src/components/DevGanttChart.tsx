import React, { useState, useEffect, useRef } from 'react'
import type { Project, Dev, ScheduleResult, TeamType } from '../types'
import { PLANNING_SPRINTS, SPRINT_LABELS, projectColor } from '../utils/scheduling'
import type { State, Action } from '../hooks/useAppState'

const SPRINT_COL = 200
const DEV_COL = 100
const ROW_H = 44
const BAR_TOP = Math.round(ROW_H * 0.2)
const BAR_HEIGHT = Math.round(ROW_H * 0.6)

interface Props {
  projects: Project[]
  devs: Dev[]
  scheduleResult: ScheduleResult
  projectIndex: Record<string, number>
  state: State
  dispatch: React.Dispatch<Action>
}

export function DevGanttChart({
  projects,
  devs,
  scheduleResult,
  projectIndex,
  state,
  dispatch,
}: Props) {
  const [editingCell, setEditingCell] = useState<{ devName: string; sprint: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [hoveredCell, setHoveredCell] = useState<{ devName: string; sprint: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const projectMap = new Map(projects.map(p => [p.id, p]))

  // Visible project IDs based on current filters — scheduling is always on all projects
  const visibleProjectIds = new Set(
    projects
      .filter(p => {
        if (p.status === 'Deprioritized') return false
        if (state.filterOwner.length > 0 && !state.filterOwner.includes(p.owner)) return false
        if (state.filterStatus.length > 0 && !state.filterStatus.includes(p.status)) return false
        if (state.filterPriority.length > 0 && !state.filterPriority.includes(p.priority ?? 'p0')) return false
        if (state.filterDev.length > 0) {
          const sched = scheduleResult.projectSchedules[p.id]
          const assigned = sched ? [...sched.assignedDevs.be, ...sched.assignedDevs.app, ...sched.assignedDevs.fe] : []
          if (!state.filterDev.some(f => assigned.includes(f))) return false
        }
        return true
      })
      .map(p => p.id)
  )
  const isFiltered = state.filterOwner.length > 0 || state.filterStatus.length > 0 ||
    state.filterPriority.length > 0 || state.filterDev.length > 0

  const beDevs = devs.filter(d => d.team === 'BE')
  const appDevs = devs.filter(d => d.team === 'APP')
  const feDevs = devs.filter(d => d.team === 'FE')

  // Auto-focus the edit input when it appears
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  function handleEditStart(devName: string, sprint: number, currentValue: number) {
    setEditingCell({ devName, sprint })
    setEditValue(currentValue.toFixed(2))
  }

  function handleEditConfirm(devName: string, sprint: number) {
    const trimmed = editValue.trim()
    if (trimmed === '') {
      dispatch({ type: 'SET_SPRINT_OVERRIDE', devName, sprint, value: null })
    } else {
      const val = parseFloat(trimmed)
      if (!isNaN(val) && val >= 0) {
        dispatch({ type: 'SET_SPRINT_OVERRIDE', devName, sprint, value: val })
      }
    }
    setEditingCell(null)
  }

  function computeTeamCapacity(teamDevs: Dev[]): {
    totalAvail: number
    totalUsed: number
    totalFree: number
  } {
    let totalAvail = 0
    let totalUsed = 0
    for (const dev of teamDevs) {
      const timeline = scheduleResult.devTimelines[dev.name]
      if (!timeline) continue
      for (const sp of PLANNING_SPRINTS) {
        totalAvail += timeline.sprintCapacity[sp] ?? 0
        const blocks = timeline.sprints[sp] ?? []
        for (const block of blocks) {
          totalUsed += block.sprintsUsed
        }
      }
    }
    return { totalAvail, totalUsed, totalFree: Math.max(0, totalAvail - totalUsed) }
  }

  function renderDevRow(dev: Dev): React.ReactElement | null {
    const timeline = scheduleResult.devTimelines[dev.name]
    if (!timeline) return null
    const overrides = state.devSprintOverrides[dev.name] ?? {}
    const hasAnyOverride = Object.keys(overrides).length > 0

    return (
      <div
        key={dev.name}
        className="flex border-b border-slate-700/40"
        style={{ height: ROW_H }}
      >
        {/* Dev name column */}
        <div
          style={{ width: DEV_COL, minWidth: DEV_COL, flexShrink: 0 }}
          className="flex flex-col justify-center px-2 border-r border-slate-700/40 overflow-hidden"
        >
          <div className="flex items-center gap-0.5 min-w-0">
            <span className="text-xs text-slate-300 font-medium truncate leading-tight">
              {dev.name}
            </span>
            {hasAnyOverride && (
              <span className="text-[9px] text-yellow-400 leading-none flex-shrink-0">✎</span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 leading-tight">
            {timeline.perSprintCapacity.toFixed(2)}/sp
          </span>
        </div>

        {/* Sprint cells */}
        {(PLANNING_SPRINTS as readonly number[]).map(sp => {
          const blocks = timeline.sprints[sp] ?? []
          const sprintCap = timeline.sprintCapacity[sp] ?? 0
          const isEditing =
            editingCell?.devName === dev.name && editingCell?.sprint === sp
          const isHovered =
            hoveredCell?.devName === dev.name && hoveredCell?.sprint === sp
          const hasOverride = overrides[sp] !== undefined

          // Pre-compute left offsets; hidden blocks still consume space in the layout
          let cumulativeLeft = 0
          const blockPositions = blocks.map(block => {
            const width = block.fraction * SPRINT_COL
            const left = cumulativeLeft
            cumulativeLeft += width
            const visible = !isFiltered || visibleProjectIds.has(block.projectId)
            return { left, width, visible }
          })

          // BE-only: mark the sprint where a project hits the prework % BE completion
          const be60Block = dev.team === 'BE'
            ? blocks.find(b => scheduleResult.projectSchedules[b.projectId]?.be60Sprint === sp && visibleProjectIds.has(b.projectId))
            : undefined
          const showBe60Marker = be60Block !== undefined
          const preworkPct = be60Block
            ? (state.bePreworkPct[be60Block.projectId] ?? 60)
            : 60

          return (
            <div
              key={sp}
              className="relative border-r border-slate-700/40 last:border-r-0"
              style={{ width: SPRINT_COL, height: ROW_H, flexShrink: 0 }}
              onMouseEnter={() => setHoveredCell({ devName: dev.name, sprint: sp })}
              onMouseLeave={() => setHoveredCell(null)}
            >
              {/* Empty-capacity background bar */}
              <div
                className="absolute rounded-sm bg-slate-800/30"
                style={{ left: 2, right: 2, top: BAR_TOP, height: BAR_HEIGHT }}
              />

              {/* Project blocks */}
              {blocks.map((block, i) => {
                const { left, width, visible } = blockPositions[i]
                if (!visible) return null
                const proj = projectMap.get(block.projectId)
                const color = projectColor(projectIndex[block.projectId] ?? 0)
                const schedule = scheduleResult.projectSchedules[block.projectId]
                const isAtRisk = schedule?.isAtRisk ?? false
                const isSelected = state.selectedProjectId === block.projectId
                const hasSelection = state.selectedProjectId !== null
                const opacity = hasSelection ? (isSelected ? 1 : 0.4) : 0.85

                const tooltipLines: string[] = [
                  proj?.roadmapItem ?? block.projectId,
                  `Owner: ${proj?.owner ?? '?'}`,
                  `Capacity: BE:${proj?.capacity.be ?? 0} APP:${proj?.capacity.app ?? 0} FE:${proj?.capacity.fe ?? 0}`,
                ]
                if (schedule) {
                  tooltipLines.push(
                    `Sprints: S${schedule.overallStart}–S${schedule.overallEnd}`,
                  )
                }
                if (isAtRisk) tooltipLines.push('⚠ AT RISK')

                const finalWidth = Math.max(width - 1, 2)

                return (
                  <div
                    key={`${block.projectId}-${i}`}
                    className="absolute rounded-sm cursor-pointer"
                    style={{
                      left,
                      top: BAR_TOP,
                      width: finalWidth,
                      height: BAR_HEIGHT,
                      backgroundColor: color,
                      opacity,
                      borderRight: isAtRisk ? '2px solid rgba(239,68,68,0.9)' : undefined,
                      outline: isSelected ? '1px solid rgba(255,255,255,0.5)' : undefined,
                      zIndex: 1,
                    }}
                    title={tooltipLines.join('\n')}
                    onClick={e => {
                      e.stopPropagation()
                      dispatch({
                        type: 'SELECT_PROJECT',
                        id:
                          state.selectedProjectId === block.projectId
                            ? null
                            : block.projectId,
                      })
                    }}
                  >
                    {finalWidth > 50 && (
                      <span className="absolute inset-0 flex items-center text-[9px] text-white truncate px-1 leading-none pointer-events-none">
                        {proj?.roadmapItem ?? block.projectId}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* be60Sprint marker: vertical line + label at right edge of the sprint cell */}
              {showBe60Marker && (
                <>
                  <div
                    className="absolute top-0 bottom-0"
                    style={{
                      right: 0,
                      width: 2,
                      backgroundColor: 'rgba(250,204,21,0.6)',
                      zIndex: 3,
                    }}
                    title={`${preworkPct}% BE completion — FE/APP can start`}
                  />
                  <span
                    className="absolute text-[7px] text-yellow-300 font-bold whitespace-nowrap leading-none"
                    style={{ right: 4, top: 2, zIndex: 4 }}
                  >
                    {preworkPct}%
                  </span>
                </>
              )}

              {/* Capacity override controls */}
              {isEditing ? (
                <div
                  className="absolute left-0 right-0 flex items-center justify-center"
                  style={{ bottom: 1, height: BAR_TOP }}
                >
                  <input
                    ref={inputRef}
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleEditConfirm(dev.name, sp)
                      if (e.key === 'Escape') setEditingCell(null)
                    }}
                    onBlur={() => handleEditConfirm(dev.name, sp)}
                    className="w-14 text-[10px] text-center bg-slate-700 text-white border border-slate-500 rounded px-1 outline-none focus:border-blue-400"
                    style={{ height: 15, zIndex: 5 }}
                    step="0.1"
                    min="0"
                  />
                </div>
              ) : isHovered ? (
                <button
                  className="absolute text-[9px] text-slate-400 hover:text-slate-200 bg-slate-700/80 hover:bg-slate-600/80 rounded px-0.5 leading-none"
                  style={{ bottom: 2, right: 2, zIndex: 5 }}
                  onClick={e => {
                    e.stopPropagation()
                    handleEditStart(dev.name, sp, sprintCap)
                  }}
                  title={`Edit capacity for S${sp}`}
                >
                  ✎
                </button>
              ) : hasOverride ? (
                <span
                  className="absolute text-[9px] text-yellow-400/70 leading-none pointer-events-none"
                  style={{ bottom: 2, right: 2, zIndex: 5 }}
                >
                  ✎
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  function renderTeamSection(team: TeamType, teamDevs: Dev[]): React.ReactElement {
    const { totalAvail, totalUsed, totalFree } = computeTeamCapacity(teamDevs)
    return (
      <div key={team}>
        {/* Team section header */}
        <div className="bg-slate-800/60 border-b border-slate-700/40 px-3 py-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {team}
          </span>
        </div>

        {/* One row per dev */}
        {teamDevs.map(dev => renderDevRow(dev))}

        {/* Capacity summary */}
        <div className="bg-slate-800/20 border-b border-slate-700/40 px-3 py-0.5">
          <span className="text-[9px] text-slate-500">
            Total {team} available: {totalAvail.toFixed(2)} sp | Used:{' '}
            {totalUsed.toFixed(2)} sp | Free: {totalFree.toFixed(2)} sp
          </span>
        </div>
      </div>
    )
  }

  const totalW = DEV_COL + SPRINT_COL * 4

  return (
    <div className="overflow-x-auto bg-slate-900">
      <div style={{ minWidth: totalW }} className="select-none">
        {/* Sticky header row */}
        <div
          className="flex sticky top-0 z-10 bg-slate-800 border-b border-slate-700"
          style={{ height: ROW_H }}
        >
          <div
            style={{ width: DEV_COL, minWidth: DEV_COL, flexShrink: 0 }}
            className="flex items-center justify-center border-r border-slate-700 text-xs text-slate-400"
          >
            Dev / Sprint
          </div>
          {(PLANNING_SPRINTS as readonly number[]).map(sp => (
            <div
              key={sp}
              style={{ width: SPRINT_COL, flexShrink: 0 }}
              className="flex items-center justify-center text-xs text-slate-400 border-r border-slate-700 last:border-r-0"
            >
              {SPRINT_LABELS[sp]}
            </div>
          ))}
        </div>

        {/* Team sections: BE → APP → FE */}
        {renderTeamSection('BE', beDevs)}
        {renderTeamSection('APP', appDevs)}
        {renderTeamSection('FE', feDevs)}
      </div>
    </div>
  )
}
