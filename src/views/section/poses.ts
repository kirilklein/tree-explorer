import { Vector3 } from 'three'
import type { ShotPose } from '../../scene/shot'
import { FLOOR, type Frame } from './frame'
import { ROWS } from './growth'
import { CELL, layerNamed, layersOf } from './layers'
import { COMPANION_ROW, PHLOEM_X, PITS, SIEVE_ROW, TRACHEIDS, WOOD_X } from './tubes'

export const STEP_DISTANCES = [1.25, 0.27, 0.17, 0.11, 0.07, 0.012]

export function sectionPoses({ n, a, at }: Frame, radius: number): ShotPose[] {
  const { inner, outer } = layerNamed(layersOf(radius), 'Cambium')
  const onFloor = (rho: number) => at(FLOOR).addScaledVector(n, rho)
  const from = (elevation: number) => n.clone().multiplyScalar(Math.cos(elevation)).addScaledVector(a, Math.sin(elevation))
  const pose = (target: Vector3, elevation: number, distance: number): ShotPose => ({
    target,
    position: target.clone().addScaledVector(from(elevation), distance),
  })
  const cambium = (inner + outer) / 2
  const across = new Vector3().crossVectors(n, a)
  const raised = (x: number, row: number, height: number) =>
    onFloor(cambium + x * CELL).addScaledVector(across, (row - (ROWS - 1) / 2) * CELL).addScaledVector(a, height * CELL)
  const [d1, d2, d3, d4, d5, d6] = STEP_DISTANCES
  return [
    pose(onFloor(0.2), 0.62, d1),
    pose(onFloor(cambium - 2.5 * CELL), 1.05, d2),
    pose(onFloor(cambium + 0.75 * CELL), 1.05, d3),
    pose(raised(WOOD_X, 3, 3.4), 0.22, d4),
    pose(raised(PHLOEM_X, (SIEVE_ROW + COMPANION_ROW) / 2, 3), 0.3, d5),
    pose(raised(WOOD_X, (TRACHEIDS[0].row + TRACHEIDS[1].row) / 2, PITS[0]), 0.15, d6),
  ]
}
