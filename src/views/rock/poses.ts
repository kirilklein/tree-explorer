import { type CatmullRomCurve3, Vector3 } from 'three'
import type { ShotPose } from '../../scene/shot'
import type { Site } from './frame'

const UP = new Vector3(0, 1, 0)

export const STEP_DISTANCES = [0.45, 0.32, 0.012, 0.035]

export function rockPoses({ tip, direction }: Site, featured: CatmullRomCurve3, contact: Vector3, normal: Vector3) {
  const side = new Vector3().crossVectors(UP, direction).normalize()
  const flat = side.clone().projectOnPlane(normal).normalize()
  const pose = (target: Vector3, from: Vector3, distance: number): ShotPose => ({
    target,
    position: target.clone().addScaledVector(from.normalize(), distance),
  })
  const [d1, d2, d3, d4] = STEP_DISTANCES
  return [
    pose(tip.clone().addScaledVector(direction, -0.05), side.clone().addScaledVector(UP, 0.6), d1),
    pose(featured.getPointAt(0).lerp(contact, 0.35), side.clone().addScaledVector(UP, 0.35), d2),
    pose(contact.clone().addScaledVector(normal, 0.0006), flat.clone().addScaledVector(normal, 0.3), d3),
    pose(featured.getPointAt(0.8), flat.clone().addScaledVector(normal, 0.3), d4),
  ]
}
