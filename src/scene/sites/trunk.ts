import { Vector3 } from 'three'
import { OVERVIEW } from '../camera'
import type { Shot } from '../shot'
import type { Tree } from '../tree'

const HEIGHT = 0.95
const DISTANCE = 2.3

export function trunkSite(tree: Tree) {
  const trunk = tree.branches.filter((b) => b.depth === 0)
  const seg = trunk.find((s) => s.end.y >= HEIGHT) ?? trunk.at(-1)!
  const t = (HEIGHT - seg.start.y) / (seg.end.y - seg.start.y)
  const axis = seg.end.clone().sub(seg.start).normalize()
  const radius = seg.startRadius + (seg.endRadius - seg.startRadius) * t
  const center = seg.start.clone().lerp(seg.end, t)
  const normal = new Vector3(...OVERVIEW.position).sub(center).projectOnPlane(axis).setY(0).normalize()
  const point = center.clone().addScaledVector(normal, radius)
  const shot: Shot = {
    arrival: { position: point.clone().addScaledVector(normal, DISTANCE).add(new Vector3(0, 0.35, 0)), target: point.clone() },
  }
  return { point, normal, axis, radius, label: point.clone(), shot }
}
