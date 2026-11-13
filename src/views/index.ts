import type { View } from './types'

export const VIEWS = {
  section: () => import('./section'),
  water: () => import('./water'),
  rock: () => import('./rock'),
  cell: () => import('./cell'),
} satisfies Record<string, () => Promise<{ default: View }>>

export type ViewId = keyof typeof VIEWS
