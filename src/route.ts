import { STOPS, type Stop } from './data/stops'
import type { ViewId } from './views'

export interface Route {
  stop: Stop | null
  view: ViewId | null
  step: number
}

const stepOf = (part = '') => (/^[1-9]\d*$/.test(part) ? Number(part) - 1 : 0)

export function parseRoute(hash: string): Route {
  const [id, inside, step] = hash.replace(/^#\/?/, '').split('/')
  if (id === 'water') return { stop: null, view: 'water', step: stepOf(inside) }
  const stop = STOPS.find((s) => s.id === id) ?? null
  if (stop && inside === 'inside') return { stop, view: stop.view, step: stepOf(step) }
  return { stop, view: null, step: 0 }
}
