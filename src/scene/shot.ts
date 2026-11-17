import { MathUtils, Vector3 } from 'three'

export const SHOT_SECONDS = 4.5

export interface ShotPose {
  position: Vector3
  target: Vector3
}

export interface Peel {
  wall: number
  deepWall: number
}

export interface Shot {
  arrival: ShotPose
  glide?: Vector3
  peel?: Peel
}

export const advance = (p: number, dir: number, dt: number) => MathUtils.clamp(p + (dir * dt) / SHOT_SECONDS, 0, 1)

const w = (p: number, from: number, to: number) => MathUtils.smootherstep(p, from, to)

export function shotAt({ arrival, glide = new Vector3() }: Shot, start: ShotPose, p: number): ShotPose {
  const s = start.position
  const g = arrival.position.clone().sub(glide)
  const angle0 = Math.atan2(s.x, s.z)
  const turn = MathUtils.euclideanModulo(Math.atan2(g.x, g.z) - angle0 + Math.PI, Math.PI * 2) - Math.PI
  const angle = angle0 + turn * w(p, 0, 0.7)
  const r0 = Math.hypot(s.x, s.z)
  const r = r0 + (Math.hypot(g.x, g.z) - r0) * w(p, 0, 0.75)
  const y = s.y + (g.y - s.y) * w(p, 0.05, 0.8)
  return {
    position: new Vector3(r * Math.sin(angle), y, r * Math.cos(angle)).addScaledVector(glide, w(p, 0.5, 1)),
    target: start.target.clone().lerp(arrival.target, w(p, 0, 0.5)),
  }
}

export const CUT_LAYERS = 4

export function wallsAt({ wall, deepWall }: Peel, p: number, open: number) {
  return Array.from({ length: CUT_LAYERS }, (_, i) => {
    const deeper = i < CUT_LAYERS - 1 ? (deepWall - wall) * w(open, 0.1 * i, 0.6 + 0.1 * i) : 0
    return wall * w(p, 0.42 + 0.07 * i, 0.68 + 0.07 * i) + deeper
  })
}
