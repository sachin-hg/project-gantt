import { useReducer, useEffect } from 'react'
import { INITIAL_PROJECTS } from '../data/projects'
import { DEVS } from '../data/devs'
import type { Project, DevAssignment, Dev } from '../types'
import { DEFAULT_OWNERS } from '../types'

export interface State {
  projects: Project[]
  devList: Dev[]                                           // full dev roster (editable)
  ownerList: string[]                                      // owner names (editable)
  devAssignments: Record<string, DevAssignment>
  devOwnerMappings: Record<string, string[]>               // devName → owners[]
  devSprintOverrides: Record<string, Record<number, number>>
  bePreworkPct: Record<string, number>
  filterOwner: string[]
  filterStatus: string[]
  filterPriority: string[]
  filterDev: string[]
  selectedProjectId: string | null
  showDevMapping: boolean
}

export type Action =
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'REMOVE_PROJECT'; id: string }
  | { type: 'UPDATE_PROJECT'; id: string; changes: Partial<Project> }
  | { type: 'SET_DEV_ASSIGNMENT'; assignment: DevAssignment }
  | { type: 'SET_DEV_OWNERS'; devName: string; owners: string[] }
  | { type: 'SET_SPRINT_OVERRIDE'; devName: string; sprint: number; value: number | null }
  | { type: 'SET_PREWORK_PCT'; projectId: string; value: number }
  | { type: 'ADD_DEV'; dev: Dev }
  | { type: 'REMOVE_DEV'; devName: string }
  | { type: 'ADD_OWNER'; name: string }
  | { type: 'REMOVE_OWNER'; name: string; replacedBy: string }
  | { type: 'SET_FILTER_OWNER'; value: string[] }
  | { type: 'SET_FILTER_STATUS'; value: string[] }
  | { type: 'SET_FILTER_PRIORITY'; value: string[] }
  | { type: 'SET_FILTER_DEV'; value: string[] }
  | { type: 'SELECT_PROJECT'; id: string | null }
  | { type: 'TOGGLE_DEV_MAPPING' }
  | { type: 'RESET' }

function mergeProjects(initial: Project[], saved: Project[]): Project[] {
  const map = new Map(saved.map(p => [p.id, p]))
  return initial.map(p => ({ ...p, ...map.get(p.id) }))
}

function buildInitial(): State {
  const devOwnerMappings = Object.fromEntries(DEVS.map(d => [d.name, [...d.owners]]))
  devOwnerMappings['Dhruvil'] = ['GC', 'Bikash']
  devOwnerMappings['Tushar']  = ['Swastik', 'Atul', 'GC']
  devOwnerMappings['Joel']    = ['Swastik', 'Atul', 'Atinder']
  return {
    projects: INITIAL_PROJECTS,
    devList: DEVS,
    ownerList: DEFAULT_OWNERS,
    devAssignments: {
      p27: { projectId: 'p27', beDevs: ['Praveen'], appDevs: [], feDevs: [] },
      p28: { projectId: 'p28', beDevs: ['Prabal'],  appDevs: [], feDevs: [] },
      p08: { projectId: 'p08', beDevs: [], appDevs: [], feDevs: [] },
      p16: { projectId: 'p16', beDevs: ['Tinisha'], appDevs: [], feDevs: [] },
      p26: { projectId: 'p26', beDevs: [], appDevs: [], feDevs: [] },
      p30: { projectId: 'p30', beDevs: [], appDevs: [], feDevs: ['Naman'] },
      p40: { projectId: 'p40', beDevs: [], appDevs: [], feDevs: ['Vansh'] },
      p38: { projectId: 'p38', beDevs: [], appDevs: [], feDevs: ['Naman'] },
    },
    devOwnerMappings,
    devSprintOverrides: {
      Praveen: { 3: 0, 4: 0.83 },
      Tinisha: { 3: 0.4, 4: 0.4, 5: 0.4, 6: 0.4 },
    },
    bePreworkPct: { p08: 15, p13: 55, p15: 20, p29: 0, p30: 0, p38: 0 },
    filterOwner: [],
    filterStatus: [],
    filterPriority: [],
    filterDev: [],
    selectedProjectId: null,
    showDevMapping: false,
  }
}

function loadState(): State {
  try {
    const raw = localStorage.getItem('gantt_state_v4')
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>
      const toArr = (v: unknown): string[] => {
        if (Array.isArray(v)) return v as string[]
        if (typeof v === 'string' && v !== 'All') return [v]
        return []
      }
      return {
        ...buildInitial(),
        ...saved,
        projects: mergeProjects(INITIAL_PROJECTS, (saved.projects as Project[]) ?? []),
        filterOwner: toArr(saved.filterOwner),
        filterStatus: toArr(saved.filterStatus),
        filterPriority: toArr(saved.filterPriority),
        filterDev: toArr(saved.filterDev),
        selectedProjectId: null,
        showDevMapping: false,
      }
    }
  } catch {}
  return buildInitial()
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.project], selectedProjectId: action.project.id }
    case 'REMOVE_PROJECT': {
      const newAssignments = { ...state.devAssignments }
      delete newAssignments[action.id]
      const newPrework = { ...state.bePreworkPct }
      delete newPrework[action.id]
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.id),
        devAssignments: newAssignments,
        bePreworkPct: newPrework,
        selectedProjectId: state.selectedProjectId === action.id ? null : state.selectedProjectId,
      }
    }
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === action.id ? { ...p, ...action.changes } : p,
        ),
      }
    case 'SET_DEV_ASSIGNMENT':
      return {
        ...state,
        devAssignments: { ...state.devAssignments, [action.assignment.projectId]: action.assignment },
      }
    case 'SET_DEV_OWNERS':
      return {
        ...state,
        devOwnerMappings: { ...state.devOwnerMappings, [action.devName]: action.owners },
      }
    case 'SET_SPRINT_OVERRIDE': {
      const devOverrides = { ...(state.devSprintOverrides[action.devName] ?? {}) }
      if (action.value === null) {
        delete devOverrides[action.sprint]
      } else {
        devOverrides[action.sprint] = action.value
      }
      return {
        ...state,
        devSprintOverrides: { ...state.devSprintOverrides, [action.devName]: devOverrides },
      }
    }
    case 'SET_PREWORK_PCT':
      return {
        ...state,
        bePreworkPct: { ...state.bePreworkPct, [action.projectId]: action.value },
      }

    case 'ADD_DEV': {
      if (state.devList.some(d => d.name === action.dev.name)) return state
      return {
        ...state,
        devList: [...state.devList, action.dev],
        devOwnerMappings: { ...state.devOwnerMappings, [action.dev.name]: [...action.dev.owners] },
      }
    }
    case 'REMOVE_DEV': {
      const newMappings = { ...state.devOwnerMappings }
      delete newMappings[action.devName]
      const newOverrides = { ...state.devSprintOverrides }
      delete newOverrides[action.devName]
      return {
        ...state,
        devList: state.devList.filter(d => d.name !== action.devName),
        devOwnerMappings: newMappings,
        devSprintOverrides: newOverrides,
        filterDev: state.filterDev.filter(d => d !== action.devName),
      }
    }

    case 'ADD_OWNER': {
      if (state.ownerList.includes(action.name)) return state
      return { ...state, ownerList: [...state.ownerList, action.name] }
    }
    case 'REMOVE_OWNER': {
      const { name, replacedBy } = action
      // Reassign all projects owned by `name` → `replacedBy`
      const projects = state.projects.map(p =>
        p.owner === name ? { ...p, owner: replacedBy } : p
      )
      // Remove `name` from every dev's owner mapping, add `replacedBy` if not present
      const devOwnerMappings = Object.fromEntries(
        Object.entries(state.devOwnerMappings).map(([devName, owners]) => {
          if (!owners.includes(name)) return [devName, owners]
          const updated = owners.filter(o => o !== name)
          if (!updated.includes(replacedBy)) updated.push(replacedBy)
          return [devName, updated]
        })
      )
      // Also update devList owners array
      const devList = state.devList.map(d => {
        if (!d.owners.includes(name)) return d
        const updated = d.owners.filter(o => o !== name)
        if (!updated.includes(replacedBy)) updated.push(replacedBy)
        return { ...d, owners: updated }
      })
      const ownerList = state.ownerList.filter(o => o !== name)
      const filterOwner = state.filterOwner.filter(o => o !== name)
      return { ...state, projects, devList, devOwnerMappings, ownerList, filterOwner }
    }

    case 'SET_FILTER_OWNER':
      return { ...state, filterOwner: action.value }
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.value }
    case 'SET_FILTER_PRIORITY':
      return { ...state, filterPriority: action.value }
    case 'SET_FILTER_DEV':
      return { ...state, filterDev: action.value }
    case 'SELECT_PROJECT':
      return { ...state, selectedProjectId: action.id }
    case 'TOGGLE_DEV_MAPPING':
      return { ...state, showDevMapping: !state.showDevMapping }
    case 'RESET':
      return buildInitial()
    default:
      return state
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    try {
      const { selectedProjectId: _s, showDevMapping: _d, ...persist } = state
      localStorage.setItem('gantt_state_v4', JSON.stringify(persist))
    } catch {}
  }, [state])

  return { state, dispatch }
}
