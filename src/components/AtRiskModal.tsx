import React, { useMemo } from 'react'
import type { Project, Dev, ScheduleResult } from '../types'
import { perSprintCapacity, dateToSprint } from '../utils/scheduling'

interface Props {
  projects: Project[]
  scheduleResult: ScheduleResult
  devList: Dev[]
  onClose: () => void
}

export const AtRiskModal: React.FC<Props> = ({ projects, scheduleResult, devList, onClose }) => {
  const { projectSchedules, devTimelines } = scheduleResult

  const rows = useMemo(() => {
    const active = projects.filter(p => p.status !== 'Done' && p.status !== 'Deprioritized')

    return active.map(p => {
      const sched = projectSchedules[p.id]
      if (!sched) return null

      const totalCap = p.capacity.be + p.capacity.app + p.capacity.fe
      const totalUnscheduled = sched.unscheduled.be + sched.unscheduled.app + sched.unscheduled.fe
      const spillPct = totalCap > 0 ? (totalUnscheduled / totalCap) * 100 : 0

      // Grace: dev working on this project in S6 gets 1 more sprint at their base capacity
      const teamGraceSolves = (devNames: string[], unscheduledAmt: number): boolean => {
        if (unscheduledAmt <= 0.001) return true
        const graceCap = devNames
          .filter(name => devTimelines[name]?.sprints[6]?.some(b => b.projectId === p.id))
          .reduce((sum, name) => {
            const dev = devList.find(d => d.name === name)
            return sum + (dev ? perSprintCapacity(dev.totalSprints) : 0)
          }, 0)
        return unscheduledAmt <= graceCap + 0.001
      }

      const beGrace = teamGraceSolves(sched.assignedDevs.be, sched.unscheduled.be)
      const appGrace = teamGraceSolves(sched.assignedDevs.app, sched.unscheduled.app)
      const feGrace = teamGraceSolves(sched.assignedDevs.fe, sched.unscheduled.fe)
      const graceSolves = beGrace && appGrace && feGrace

      return { p, sched, totalCap, totalUnscheduled, spillPct, graceSolves, graceByTeam: { be: beGrace, app: appGrace, fe: feGrace }, isAtRisk: sched.isAtRisk }
    }).filter((r): r is NonNullable<typeof r> => r !== null)
  }, [projects, projectSchedules, devTimelines, devList])

  const priorityOrd: Record<string, number> = { p0: 0, p1: 1, p2: 2 }
  const atRiskRows = rows
    .filter(r => r.isAtRisk)
    .sort((a, b) => {
      const pd = (priorityOrd[a.p.priority ?? 'p0'] ?? 0) - (priorityOrd[b.p.priority ?? 'p0'] ?? 0)
      if (pd !== 0) return pd
      // unsolvable first (graceSolves=false before true)
      const gd = (b.graceSolves ? 1 : 0) - (a.graceSolves ? 1 : 0)
      if (gd !== 0) return gd
      return a.totalUnscheduled - b.totalUnscheduled
    })
  const activeCount = rows.length
  const atRiskCount = atRiskRows.length
  const deliveredCount = activeCount - atRiskCount
  const graceSolvesCount = atRiskRows.filter(r => r.graceSolves).length

  const deliveryPct = activeCount > 0 ? Math.round((deliveredCount / activeCount) * 100) : 0
  const deliveryGracePct = activeCount > 0
    ? Math.round(((deliveredCount + graceSolvesCount) / activeCount) * 100)
    : 0

  // Team-level spill aggregates
  const teamSpill = { be: 0, app: 0, fe: 0 }
  const teamGraceRecovered = { be: 0, app: 0, fe: 0 }
  atRiskRows.forEach(r => {
    teamSpill.be  += r.sched.unscheduled.be
    teamSpill.app += r.sched.unscheduled.app
    teamSpill.fe  += r.sched.unscheduled.fe
    if (r.graceByTeam.be)  teamGraceRecovered.be  += r.sched.unscheduled.be
    if (r.graceByTeam.app) teamGraceRecovered.app += r.sched.unscheduled.app
    if (r.graceByTeam.fe)  teamGraceRecovered.fe  += r.sched.unscheduled.fe
  })

  const byPriority: Record<string, number> = { p0: 0, p1: 0, p2: 0 }
  atRiskRows.forEach(r => { byPriority[r.p.priority ?? 'p0'] = (byPriority[r.p.priority ?? 'p0'] ?? 0) + 1 })
  const totalByPriority: Record<string, number> = { p0: 0, p1: 0, p2: 0 }
  rows.forEach(r => { totalByPriority[r.p.priority ?? 'p0'] = (totalByPriority[r.p.priority ?? 'p0'] ?? 0) + 1 })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-red-400">⚠ {atRiskCount} At Risk</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] bg-red-900/30 border border-red-800/40 rounded px-2 py-0.5 text-red-300">
                P0 · <span className="font-bold">{totalByPriority.p0 - byPriority.p0}/{totalByPriority.p0}</span>
              </span>
              <span className="text-[11px] bg-amber-900/30 border border-amber-800/40 rounded px-2 py-0.5 text-amber-300">
                P1 · <span className="font-bold">{totalByPriority.p1 - byPriority.p1}/{totalByPriority.p1}</span>
              </span>
              <span className="text-[11px] bg-slate-700/40 border border-slate-600/40 rounded px-2 py-0.5 text-slate-400">
                P2 · <span className="font-bold">{totalByPriority.p2 - byPriority.p2}/{totalByPriority.p2}</span>
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-lg leading-none ml-4">✕</button>
        </div>

        {/* Headcount warning */}
        <div className="flex items-start gap-2.5 px-5 py-2.5 bg-amber-950/40 border-b border-amber-800/40 flex-shrink-0">
          <span className="text-amber-400 text-sm flex-shrink-0 mt-px">⚠</span>
          <p className="text-[11px] text-amber-300 leading-snug">
            <span className="font-semibold">Based on current headcount.</span>
            {' '}Himanshu and Joel are at risk of / already on resignation — actual delivery may be worse if either exits before quarter end.
          </p>
        </div>

        {/* Delivery summary */}
        <div className="px-5 py-3 bg-slate-800/60 border-b border-slate-700 flex-shrink-0 flex flex-wrap items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{deliveryPct}%</span>
            <span className="text-xs text-slate-400">delivery without grace</span>
          </div>
          <svg className="h-4 w-4 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">{deliveryGracePct}%</span>
            <span className="text-xs text-slate-400">with grace (+1 sprint)</span>
          </div>
          <div className="ml-auto text-[11px] text-slate-500 text-right">
            <span>{activeCount} active</span>
            <span className="mx-1.5 text-slate-700">·</span>
            <span className="text-emerald-500">{deliveredCount} on track</span>
            <span className="mx-1.5 text-slate-700">·</span>
            <span className="text-red-400">{atRiskCount} at risk</span>
            {graceSolvesCount > 0 && (
              <>
                <span className="mx-1.5 text-slate-700">·</span>
                <span className="text-emerald-400">{graceSolvesCount} grace-saved</span>
              </>
            )}
          </div>
        </div>

        {/* Team bandwidth spill breakdown */}
        <div className="px-5 py-2.5 bg-slate-800/40 border-b border-slate-700 flex-shrink-0 flex flex-wrap items-center gap-x-6 gap-y-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 flex-shrink-0">Unscheduled by skill</span>
          {(['BE', 'FE', 'APP'] as const).map(team => {
            const key = team.toLowerCase() as 'be' | 'fe' | 'app'
            const spill = teamSpill[key]
            const recovered = teamGraceRecovered[key]
            const remaining = spill - recovered
            if (spill < 0.001) return (
              <div key={team} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 font-semibold w-8">{team}</span>
                <span className="text-emerald-500">0sp</span>
              </div>
            )
            return (
              <div key={team} className="flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-400 font-semibold w-8">{team}</span>
                <span className="text-red-300 tabular-nums">{spill.toFixed(2)}sp</span>
                <svg className="h-3 w-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                {remaining < 0.001
                  ? <span className="text-emerald-400 tabular-nums">0sp <span className="text-slate-500 font-normal">(grace clears)</span></span>
                  : <span className="tabular-nums">
                      <span className="text-amber-300">{remaining.toFixed(2)}sp</span>
                      {recovered > 0.001 && <span className="text-slate-500 ml-1">({recovered.toFixed(2)} grace-saved)</span>}
                    </span>
                }
              </div>
            )
          })}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-400 w-12">ID</th>
                <th className="text-left px-3 py-2.5 font-semibold text-slate-400">Project</th>
                <th className="text-center px-3 py-2.5 font-semibold text-slate-400 w-16">Pri</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-400 w-20">Cap (sp)</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-400 w-24">Unscheduled</th>
                <th className="text-right px-3 py-2.5 font-semibold text-slate-400 w-20">% Spill</th>
                <th className="text-center px-3 py-2.5 font-semibold text-slate-400 w-28">Grace Solves?</th>
              </tr>
            </thead>
            <tbody>
              {atRiskRows.map(({ p, sched, totalCap, totalUnscheduled, spillPct, graceSolves }) => (
                <tr key={p.id} className="border-b border-slate-800/80 hover:bg-slate-800/40">
                  <td className="px-3 py-2 font-mono text-slate-500 text-[10px]">{p.id}</td>
                  <td className="px-3 py-2 text-slate-200 max-w-[260px]">
                    <div className="truncate leading-snug">{p.roadmapItem}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{p.owner}</span>
                      <span className="text-slate-700">·</span>
                      <span>
                        Ready <span className="text-slate-400">S{dateToSprint(p.ticketReadyDate)}</span>
                      </span>
                      <span className="text-slate-700">·</span>
                      {(() => {
                        const anyAssigned = sched.assignedDevs.be.length > 0 || sched.assignedDevs.app.length > 0 || sched.assignedDevs.fe.length > 0
                        return anyAssigned
                          ? <span>Picked <span className="text-slate-400">S{sched.overallStart}</span></span>
                          : <span className="text-red-500/70">Not picked</span>
                      })()}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`font-semibold ${p.priority === 'p0' ? 'text-red-400' : p.priority === 'p1' ? 'text-amber-400' : 'text-slate-400'}`}>
                      {p.priority ?? 'p0'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{totalCap.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums font-medium">{totalUnscheduled.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={`font-semibold ${spillPct >= 75 ? 'text-red-400' : spillPct >= 40 ? 'text-amber-400' : 'text-yellow-300'}`}>
                      {spillPct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {graceSolves
                      ? <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold"><span className="text-[10px]">✓</span> Yes</span>
                      : <span className="inline-flex items-center gap-1 text-red-400 font-semibold"><span className="text-[10px]">✗</span> No</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
