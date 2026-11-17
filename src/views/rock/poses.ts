import { type CatmullRomCurve3, Vector3 } from 'three'
import type { ShotPose } from '../../scene/shot'
import type { Site } from './frame'
import { HAIR_ANGLE, HAIR_LENGTH, uptakeFrame } from './uptake'

const UP = new Vector3(0, 1, 0)

export const STEP_DISTANCES = [0.45, 0.32, 0.012, 0.035, 0.05, 0.085]

export function rockPoses(site: Site, featured: CatmullRomCurve3, contact: Vector3, normal: Vector3) {
  const { tip, direction } = site
  const side = new Vector3().crossVectors(UP, direction).normalize()
  const flat = side.clone().projectOnPlane(normal).normalize()
  const pose = (target: Vector3, from: Vector3, distance: number): ShotPose => ({
    target,
    position: target.clone().addScaledVector(from.normalize(), distance),
  })
  const [d1, d2, d3, d4, d5, d6] = STEP_DISTANCES
  const cut = uptakeFrame(site)
  const facing = direction.clone().multiplyScalar(0.8).addScaledVector(cut.w, 0.6)
  const thick = site.radius * 1.1
  return [
    pose(tip.clone().addScaledVector(direction, -0.05), side.clone().addScaledVector(UP, 0.6), d1),
    pose(featured.getPointAt(0).lerp(contact, 0.35), side.clone().addScaledVector(UP, 0.35), d2),
    pose(contact.clone().addScaledVector(normal, 0.0006), flat.clone().addScaledVector(normal, 0.3), d3),
    pose(featured.getPointAt(0.8), flat.clone().addScaledVector(normal, 0.3), d4),
    pose(cut.at(thick + HAIR_LENGTH * 0.5, HAIR_ANGLE), facing.clone(), d5),
    pose(cut.at(thick * 0.6, HAIR_ANGLE - 0.25), facing.clone(), d6),
  ]
}
