import React, { useState } from 'react'
import { perSprintCapacity } from '../utils/scheduling'
import type { Dev, TeamType } from '../types'
import type { State, Action } from '../hooks/useAppState'

const PLANNING_SPRINTS = [3, 4, 5, 6] as const
const SPRINT_SHORT: Record<number, string> = { 3: 'S3', 4: 'S4', 5: 'S5', 6: 'S6' }
const TEAMS: TeamType[] = ['BE', 'APP', 'FE']
const BW_OPTIONS = [1, 2, 3, 4, 5, 6]

interface Props { state: State; dispatch: React.Dispatch<Action> }

export function DevMappingModal({ state, dispatch }: Props) {
  const close = () => dispatch({ type: 'TOGGLE_DEV_MAPPING' })
  const [activeTab, setActiveTab] = useState<'devs' | 'owners'>('devs')

  // ── Add Dev form state ───────────────────────────────────────────────────────
  const [addDevForm, setAddDevForm] = useState<{ name: string; team: TeamType; bw: number } | null>(null)

  // ── Remove owner confirmation state ─────────────────────────────────────────
  const [removingOwner, setRemovingOwner] = useState<string | null>(null)
  const [replacementOwner, setReplacementOwner] = useState('')

  // ── Add owner form state ─────────────────────────────────────────────────────
  const [newOwnerName, setNewOwnerName] = useState('')

  function submitAddDev() {
    if (!addDevForm) return
    const name = addDevForm.name.trim()
    if (!name) return
    const dev: Dev = {
      name,
      team: addDevForm.team,
      totalSprints: addDevForm.bw,
      owners: [],
    }
    dispatch({ type: 'ADD_DEV', dev })
    setAddDevForm(null)
  }

  function confirmRemoveOwner() {
    if (!removingOwner || !replacementOwner) return
    dispatch({ type: 'REMOVE_OWNER', name: removingOwner, replacedBy: replacementOwner })
    setRemovingOwner(null)
    setReplacementOwner('')
  }

  function submitAddOwner() {
    const name = newOwnerName.trim()
    if (!name) return
    dispatch({ type: 'ADD_OWNER', name })
    setNewOwnerName('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={close}>
      <div
        className="bg-slate-800 rounded-lg shadow-2xl border border-slate-600 w-[920px] max-h-[88vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-slate-100">Team Settings</h2>
            <div className="flex gap-1">
              {(['devs', 'owners'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`text-xs px-3 py-1 rounded ${activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'}`}>
                  {tab === 'devs' ? 'Developers' : 'Owners'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={close} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">

          {/* ── DEVS TAB ── */}
          {activeTab === 'devs' && (
            <div className="space-y-6">
              {TEAMS.map(team => (
                <div key={team}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{team}</h3>
                    <button
                      onClick={() => setAddDevForm(addDevForm?.team === team ? null : { name: '', team, bw: 6 })}
                      className="text-[10px] text-blue-400 hover:text-blue-300 border border-blue-700 rounded px-2 py-0.5 transition-colors">
                      + Add {team} Dev
                    </button>
                  </div>

                  {/* Add dev inline form */}
                  {addDevForm?.team === team && (
                    <div className="flex items-center gap-2 mb-2 bg-slate-700/40 rounded p-2 border border-blue-700/40">
                      <input
                        autoFocus
                        type="text" placeholder="Dev name"
                        value={addDevForm.name}
                        onChange={e => setAddDevForm({ ...addDevForm, name: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') submitAddDev(); if (e.key === 'Escape') setAddDevForm(null) }}
                        className="flex-1 bg-slate-700 border border-slate-500 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      <label className="text-[10px] text-slate-400">BW</label>
                      <select value={addDevForm.bw}
                        onChange={e => setAddDevForm({ ...addDevForm, bw: parseInt(e.target.value) })}
                        className="bg-slate-700 border border-slate-500 rounded px-1 py-1 text-xs text-slate-100 focus:outline-none">
                        {BW_OPTIONS.map(b => <option key={b} value={b}>{b} ({perSprintCapacity(b).toFixed(2)}/sp)</option>)}
                      </select>
                      <button onClick={submitAddDev}
                        className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors">
                        Add
                      </button>
                      <button onClick={() => setAddDevForm(null)}
                        className="text-xs text-slate-400 hover:text-slate-200">Cancel</button>
                    </div>
                  )}

                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 text-[10px] uppercase tracking-wider">
                        <th className="text-left pb-1 w-24">Dev</th>
                        <th className="text-left pb-1 w-16">BW</th>
                        {state.ownerList.map(o => (
                          <th key={o} className="pb-1 w-12 text-center">{o}</th>
                        ))}
                        <th className="text-left pb-1 pl-2" colSpan={4}>Sprint overrides (blank = auto)</th>
                        <th className="w-6" />
                      </tr>
                    </thead>
                    <tbody>
                      {state.devList.filter(d => d.team === team).map(dev => {
                        const baseCap = perSprintCapacity(dev.totalSprints)
                        const currentOwners = state.devOwnerMappings[dev.name] ?? dev.owners
                        const overrides = state.devSprintOverrides[dev.name] ?? {}

                        return (
                          <tr key={dev.name} className="border-t border-slate-700/40 group">
                            <td className="py-2 text-slate-200 font-medium">{dev.name}</td>
                            <td className="py-2 text-slate-400 font-mono text-[10px]">
                              {dev.totalSprints}
                              <span className="text-slate-600 ml-1">({baseCap.toFixed(2)}/sp)</span>
                            </td>

                            {/* Owner checkboxes */}
                            {state.ownerList.map(owner => (
                              <td key={owner} className="py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={currentOwners.includes(owner)}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...currentOwners, owner]
                                      : currentOwners.filter(o => o !== owner)
                                    dispatch({ type: 'SET_DEV_OWNERS', devName: dev.name, owners: next })
                                  }}
                                  className="accent-blue-500 w-3.5 h-3.5"
                                />
                              </td>
                            ))}

                            {/* Per-sprint overrides */}
                            {PLANNING_SPRINTS.map(sp => {
                              const hasOverride = overrides[sp] !== undefined
                              return (
                                <td key={sp} className="py-1 pl-2">
                                  <div className="flex flex-col items-start">
                                    <span className="text-[9px] text-slate-500 mb-0.5">{SPRINT_SHORT[sp]}</span>
                                    <input
                                      type="number" min={0} max={1} step={0.1}
                                      placeholder={baseCap.toFixed(2)}
                                      value={hasOverride ? overrides[sp] : ''}
                                      onChange={e => {
                                        const val = e.target.value
                                        dispatch({
                                          type: 'SET_SPRINT_OVERRIDE', devName: dev.name, sprint: sp,
                                          value: val === '' ? null : parseFloat(val),
                                        })
                                      }}
                                      className={`w-14 text-xs font-mono rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                        hasOverride
                                          ? 'bg-amber-900/40 border border-amber-600 text-amber-300'
                                          : 'bg-slate-700 border border-slate-600 text-slate-300'
                                      }`}
                                    />
                                  </div>
                                </td>
                              )
                            })}

                            {/* Remove dev */}
                            <td className="py-2 pl-2">
                              <button
                                onClick={() => {
                                  if (window.confirm(`Remove ${dev.name} from the team?`)) {
                                    dispatch({ type: 'REMOVE_DEV', devName: dev.name })
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-300 text-sm transition-opacity leading-none"
                                title="Remove dev">
                                ×
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* ── OWNERS TAB ── */}
          {activeTab === 'owners' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Removing an owner reassigns all their projects and dev mappings to the chosen replacement.
              </p>

              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-700">
                    <th className="text-left pb-2 w-32">Owner</th>
                    <th className="text-left pb-2">Projects</th>
                    <th className="text-left pb-2">Devs</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {state.ownerList.map(owner => {
                    const projectCount = state.projects.filter(p => p.owner === owner).length
                    const devNames = state.devList
                      .filter(d => (state.devOwnerMappings[d.name] ?? d.owners).includes(owner))
                      .map(d => d.name)

                    const isRemoving = removingOwner === owner
                    const otherOwners = state.ownerList.filter(o => o !== owner)

                    return (
                      <React.Fragment key={owner}>
                        <tr className="border-t border-slate-700/40">
                          <td className="py-2.5 font-semibold text-slate-200">{owner}</td>
                          <td className="py-2.5 text-slate-400">{projectCount} project{projectCount !== 1 ? 's' : ''}</td>
                          <td className="py-2.5 text-slate-400">{devNames.length > 0 ? devNames.join(', ') : '—'}</td>
                          <td className="py-2.5 text-right">
                            {!isRemoving ? (
                              <button
                                disabled={state.ownerList.length <= 1}
                                onClick={() => { setRemovingOwner(owner); setReplacementOwner(otherOwners[0] ?? '') }}
                                className="text-[10px] text-red-400 hover:text-red-300 border border-red-800 rounded px-2 py-0.5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                Remove
                              </button>
                            ) : (
                              <button onClick={() => setRemovingOwner(null)}
                                className="text-[10px] text-slate-400 hover:text-slate-200">
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Inline replacement picker */}
                        {isRemoving && (
                          <tr className="bg-red-900/10">
                            <td colSpan={4} className="py-2 px-3">
                              <div className="flex items-center gap-3 text-xs">
                                <span className="text-red-300">Reassign {projectCount} project{projectCount !== 1 ? 's' : ''} to:</span>
                                <select value={replacementOwner}
                                  onChange={e => setReplacementOwner(e.target.value)}
                                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-blue-500">
                                  {otherOwners.map(o => <option key={o}>{o}</option>)}
                                </select>
                                <button onClick={confirmRemoveOwner}
                                  className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-white transition-colors">
                                  Confirm removal
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>

              {/* Add owner */}
              <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2">
                <label className="text-xs text-slate-400 flex-shrink-0">Add owner:</label>
                <input
                  type="text" placeholder="Owner name"
                  value={newOwnerName}
                  onChange={e => setNewOwnerName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitAddOwner() }}
                  className="flex-1 max-w-48 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                <button onClick={submitAddOwner}
                  disabled={!newOwnerName.trim()}
                  className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white disabled:opacity-40 transition-colors">
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-700 flex justify-between items-center flex-shrink-0">
          <span className="text-xs text-slate-500">
            {activeTab === 'devs'
              ? 'Sprint overrides in amber — blank resets to auto-computed capacity'
              : 'Removing an owner updates all projects and dev mappings automatically'}
          </span>
          <button onClick={close}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
