import { MathUtils, Vector3 } from 'three'
import type { FeaturedRoot } from './tree'

export const SHOT_SECONDS = 4.5
const EYE_HEIGHT = -0.35

export interface ShotPose {
  position: Vector3
  target: Vector3
}

export interface ShotPlan extends ShotPose {
  glide: Vector3
  wall: number
  deepWall: number
}

export interface ShotFrame extends ShotPose {
  walls: number[]
}

export function planShot({ stem, fork, branch }: FeaturedRoot): ShotPlan {
  const out = new Vector3(fork.x - stem[0].x, 0, fork.z - stem[0].z).normalize()
  const side = new Vector3(out.z, 0, -out.x)
  const position = fork.clone().addScaledVector(out, 1.5).addScaledVector(side, 3.06).setY(EYE_HEIGHT)
  return {
    position,
    target: fork.clone(),
    glide: out.multiplyScalar(-1.2),
    wall: fork.x - 1.1,
    deepWall: branch.at(-1)!.x - 0.6,
  }
}

export const advance = (p: number, dir: number, dt: number) => MathUtils.clamp(p + (dir * dt) / SHOT_SECONDS, 0, 1)

const w = (p: number, from: number, to: number) => MathUtils.smootherstep(p, from, to)

export function shotAt(plan: ShotPlan, start: ShotPose, p: number): ShotFrame {
  const s = start.position
  const g = plan.position.clone().sub(plan.glide)
  const angle0 = Math.atan2(s.x, s.z)
  const turn = MathUtils.euclideanModulo(Math.atan2(g.x, g.z) - angle0 + Math.PI, Math.PI * 2) - Math.PI
  const angle = angle0 + turn * w(p, 0, 0.7)
  const r0 = Math.hypot(s.x, s.z)
  const r = r0 + (Math.hypot(g.x, g.z) - r0) * w(p, 0, 0.75)
  const y = s.y + (g.y - s.y) * w(p, 0.05, 0.8)
  return {
    position: new Vector3(r * Math.sin(angle), y, r * Math.cos(angle)).addScaledVector(plan.glide, w(p, 0.5, 1)),
    target: start.target.clone().lerp(plan.target, w(p, 0, 0.5)),
    walls: wallsAt(plan, p, 0),
  }
}

export const CUT_LAYERS = 4

export function wallsAt(plan: ShotPlan, p: number, open: number) {
  return Array.from({ length: CUT_LAYERS }, (_, i) => {
    const deeper = i < CUT_LAYERS - 1 ? (plan.deepWall - plan.wall) * w(open, 0.1 * i, 0.6 + 0.1 * i) : 0
    return plan.wall * w(p, 0.42 + 0.07 * i, 0.68 + 0.07 * i) + deeper
  })
}
