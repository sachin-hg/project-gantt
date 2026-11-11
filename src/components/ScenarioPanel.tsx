import React, { useState, useRef, useEffect } from 'react'

export interface ScenarioConfig {
  ticketShift: { active: boolean; scope: 'all' | 'late'; sprints: number }
  extraDevs: { active: boolean; devs: Array<{ skill: 'BE' | 'FE' | 'APP'; capacity: number; fromSprint: 4.5 | 5 | 6 }> }
}

export const DEFAULT_SCENARIO: ScenarioConfig = {
  ticketShift: { active: false, scope: 'all', sprints: 1 },
  extraDevs: { active: false, devs: [{ skill: 'BE', capacity: 0.7, fromSprint: 5 }] },
}

interface Props {
  scenario: ScenarioConfig
  onChange: (s: ScenarioConfig) => void
}

function Stepper({ value, min, max, onChange, label }: {
  value: number; min: number; max: number; onChange: (v: number) => void; label?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs flex items-center justify-center leading-none select-none"
      >−</button>
      <span className="text-xs text-slate-200 w-16 text-center tabular-nums">
        {value}{label ? ` ${label}` : ''}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs flex items-center justify-center leading-none select-none"
      >+</button>
    </div>
  )
}

export function ScenarioPanel({ scenario, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const isActive = scenario.ticketShift.active || scenario.extraDevs.active

  const setShift = (patch: Partial<ScenarioConfig['ticketShift']>) =>
    onChange({ ...scenario, ticketShift: { ...scenario.ticketShift, ...patch } })
  const setDevs = (patch: Partial<ScenarioConfig['extraDevs']>) =>
    onChange({ ...scenario, extraDevs: { ...scenario.extraDevs, ...patch } })

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`text-xs px-3 py-1 rounded border transition-colors flex items-center gap-1.5 ${
          isActive
            ? 'border-violet-500 text-violet-300 bg-violet-900/30 hover:border-violet-400'
            : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
        }`}
      >
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 animate-pulse" />}
        Scenarios
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 w-72 space-y-5">

          {/* Option 1 & 2: Ticket shift */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Ticket acceleration</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Move ticket ready dates earlier</p>
              </div>
              <input
                type="checkbox"
                checked={scenario.ticketShift.active}
                onChange={e => setShift({ active: e.target.checked })}
                className="accent-violet-500 w-3.5 h-3.5"
              />
            </div>
            <div className={`space-y-2 ${!scenario.ticketShift.active ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="ts-scope"
                  checked={scenario.ticketShift.scope === 'all'}
                  onChange={() => setShift({ scope: 'all' })}
                  className="accent-violet-500"
                />
                <span className="text-xs text-slate-300">All tickets</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="ts-scope"
                  checked={scenario.ticketShift.scope === 'late'}
                  onChange={() => setShift({ scope: 'late' })}
                  className="accent-violet-500"
                />
                <span className="text-xs text-slate-300">Late tickets only <span className="text-slate-500">(S5 / S6)</span></span>
              </label>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-500 w-16">Shift by</span>
                <Stepper
                  value={scenario.ticketShift.sprints}
                  min={1} max={3}
                  onChange={v => setShift({ sprints: v })}
                  label={scenario.ticketShift.sprints === 1 ? 'sprint' : 'sprints'}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700" />

          {/* Option 3: Extra devs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Add contractors</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Owner-agnostic · per-sprint capacity configurable</p>
              </div>
              <input
                type="checkbox"
                checked={scenario.extraDevs.active}
                onChange={e => setDevs({ active: e.target.checked })}
                className="accent-violet-500 w-3.5 h-3.5"
              />
            </div>
            <div className={`space-y-1.5 ${!scenario.extraDevs.active ? 'opacity-40 pointer-events-none' : ''}`}>
              {scenario.extraDevs.devs.map((dev, i) => {
                const skillCount = scenario.extraDevs.devs.slice(0, i + 1).filter(d => d.skill === dev.skill).length
                const updateDev = (patch: Partial<typeof dev>) => {
                  const updated = [...scenario.extraDevs.devs]
                  updated[i] = { ...dev, ...patch }
                  setDevs({ devs: updated })
                }
                const btnBase = 'text-[9px] border rounded transition-colors leading-none py-px'
                const btnOn  = 'border-violet-500 bg-violet-900/40 text-violet-300'
                const btnOff = 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                return (
                  <div key={i} className="flex items-center gap-1 text-[9px]">
                    <span className="text-slate-500 font-mono w-8 flex-shrink-0">+{dev.skill}{skillCount}</span>

                    {/* skill */}
                    {(['BE', 'FE', 'APP'] as const).map(s => (
                      <button key={s} onClick={() => updateDev({ skill: s })}
                        className={`${btnBase} px-1 ${dev.skill === s ? btnOn : btnOff}`}>{s}</button>
                    ))}

                    <span className="text-slate-700 mx-0.5">·</span>

                    {/* capacity */}
                    <input
                      type="number" min={0.1} max={1.0} step={0.05}
                      value={dev.capacity}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v)) updateDev({ capacity: Math.min(1, Math.max(0.1, Math.round(v * 100) / 100)) })
                      }}
                      className="w-9 text-center bg-slate-700 border border-slate-600 rounded px-0.5 py-px text-slate-200 tabular-nums focus:outline-none focus:border-violet-500 text-[9px]"
                    />
                    <span className="text-slate-500 flex-shrink-0">sp</span>

                    <span className="text-slate-700 mx-0.5">·</span>

                    {/* from sprint */}
                    <span className="text-slate-500 flex-shrink-0">S</span>
                    {([4.5, 5, 6] as const).map(sp => (
                      <button key={sp} onClick={() => updateDev({ fromSprint: sp })}
                        className={`${btnBase} px-1 text-center ${dev.fromSprint === sp ? btnOn : btnOff}`}>
                        {sp === 4.5 ? '4½' : sp}
                      </button>
                    ))}

                    <button
                      onClick={() => setDevs({ devs: scenario.extraDevs.devs.filter((_, j) => j !== i) })}
                      className="ml-auto text-slate-600 hover:text-red-400 transition-colors leading-none"
                    >×</button>
                  </div>
                )
              })}
              {scenario.extraDevs.devs.length < 5 && (
                <button
                  onClick={() => setDevs({ devs: [...scenario.extraDevs.devs, { skill: 'BE', capacity: 0.7, fromSprint: 5 as const }] })}
                  className="text-[9px] text-slate-500 hover:text-violet-400 transition-colors mt-0.5"
                >
                  + add dev
                </button>
              )}
            </div>
          </div>

          {isActive && (
            <>
              <div className="border-t border-slate-700" />
              <button
                onClick={() => onChange(DEFAULT_SCENARIO)}
                className="w-full text-xs py-1 rounded border border-slate-700 text-slate-500 hover:border-red-700 hover:text-red-400 transition-colors"
              >
                Clear scenarios
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
