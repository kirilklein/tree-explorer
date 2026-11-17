import type { Vector3 } from 'three'
import type { ShotPose } from '../../scene/shot'
import { FLOOR, type Frame } from './frame'
import { CELL, layerNamed, layersOf } from './layers'

export const STEP_DISTANCES = [1.25, 0.27, 0.17]

export function sectionPoses({ n, a, at }: Frame, radius: number): ShotPose[] {
  const { inner, outer } = layerNamed(layersOf(radius), 'Cambium')
  const onFloor = (rho: number) => at(FLOOR).addScaledVector(n, rho)
  const from = (elevation: number) => n.clone().multiplyScalar(Math.cos(elevation)).addScaledVector(a, Math.sin(elevation))
  const pose = (target: Vector3, elevation: number, distance: number): ShotPose => ({
    target,
    position: target.clone().addScaledVector(from(elevation), distance),
  })
  const cambium = (inner + outer) / 2
  const [d1, d2, d3] = STEP_DISTANCES
  return [
    pose(onFloor(0.2), 0.62, d1),
    pose(onFloor(cambium - 2.5 * CELL), 1.05, d2),
    pose(onFloor(cambium + 0.75 * CELL), 1.05, d3),
  ]
}
