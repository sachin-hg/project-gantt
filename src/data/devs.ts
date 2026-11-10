import type { Dev } from '../types'

export const DEVS: Dev[] = [
  // BE
  { name: 'Himanshu',  team: 'BE',  totalSprints: 6, owners: ['Swastik','Atul','GC','Bikash'] },
  { name: 'Divyansh',  team: 'BE',  totalSprints: 6, owners: ['Swastik','Atul','GC','Bikash'] },
  { name: 'Praveen',   team: 'BE',  totalSprints: 6, owners: ['Swastik'] },
  { name: 'Prabal',    team: 'BE',  totalSprints: 6, owners: ['Swastik'] },
  { name: 'Urvashi',   team: 'BE',  totalSprints: 6, owners: ['Atinder'] },
  { name: 'Joel',      team: 'BE',  totalSprints: 4, owners: ['Swastik','Atul'] },
  { name: 'Vanshika',  team: 'BE',  totalSprints: 4, owners: ['Atinder'] },
  { name: 'Tinisha',   team: 'BE',  totalSprints: 2, owners: ['Swastik','Atul','GC','Bikash'] },
  // FE
  { name: 'Dhruvil',   team: 'FE',  totalSprints: 6, owners: ['Swastik','Atul','GC','Bikash'] },
  { name: 'Naman',     team: 'FE',  totalSprints: 6, owners: ['Atinder'] },
  { name: 'Vansh',     team: 'FE',  totalSprints: 6, owners: ['Atinder'] },
  { name: 'Prakhar',   team: 'FE',  totalSprints: 6, owners: ['Swastik','Atul','Bikash','GC'] },
  { name: 'Tushar',    team: 'FE',  totalSprints: 6, owners: ['Swastik','Atul'] },
  // APP
  { name: 'Rohit',     team: 'APP', totalSprints: 6, owners: ['Swastik','Atul'] },
  { name: 'Sahil',     team: 'APP', totalSprints: 6, owners: ['Swastik','Atul','GC','Bikash'] },
  { name: 'Anand',     team: 'APP', totalSprints: 6, owners: ['Swastik','Atul','GC','Bikash'] },
]

export function getDevAvailableSprints(dev: Dev): number {
  const elapsed = 2
  const remaining = Math.max(0, dev.totalSprints - elapsed)
  if (remaining === 0) return 0
  // tech/support = 1/6 of total bandwidth, proportionally remaining
  const techSupport = (dev.totalSprints / 6) * (remaining / dev.totalSprints)
  return Math.max(0, remaining - techSupport)
}

export function getDevsByTeam(team: Dev['team']): Dev[] {
  return DEVS.filter(d => d.team === team)
}

export function getDevsForProject(projectOwner: string, team: Dev['team']): Dev[] {
  return DEVS.filter(d => d.team === team && d.owners.includes(projectOwner as any))
}
