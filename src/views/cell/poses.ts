import { type BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import type { ShotPose } from '../../scene/shot'
import { C, type LeafSite, sectionFrame } from './frame'

export const DISTANCES = [1, 0.012, 11 * C, 0.85 * C]
export const CELL = new Vector3(0, 1.27 * C, -0.45 * C)
export const CHLOROPLAST = new Vector3(0, 0, 0.3 * C)
export const SLIDE = 0.6 * C
export const STACK = { wall: 2.55, membrane: 1.4, chloroplasts: 0.15, vacuole: -1.05, nucleus: -2, mitochondria: -2.75 }

const TILT = 0.17
const ACROSS = -0.6

export function leafPlan(leaf: LeafSite, geometry: BufferGeometry) {
  const { local, rest } = sectionFrame(leaf, geometry)
  const [x, y, z] = [new Vector3(), new Vector3(), new Vector3()]
  rest.extractBasis(x, y, z)
  const view = z.multiplyScalar(Math.cos(TILT)).addScaledVector(y, -Math.sin(TILT)).addScaledVector(x, ACROSS).normalize()
  const right = new Vector3(0, 1, 0).cross(view).normalize()
  const up = view.clone().cross(right)
  const toLocal = new Matrix4().extractRotation(rest).transpose()
  const [F, R, U] = [view, right, up].map((v) => v.clone().applyMatrix4(toLocal))
  const turn = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(U.clone().negate(), R, F))
  const center = CELL.clone().addScaledVector(F, 4 * C)
  const slot = (row: number) => center.clone().addScaledVector(R, -0.5 * C).addScaledVector(U, row * C).sub(CELL)
  const chloroplast = CELL.clone()
    .add(slot(STACK.chloroplasts))
    .add(CHLOROPLAST.clone().applyQuaternion(turn))
    .addScaledVector(F, SLIDE)
  const world = (p: Vector3) => p.clone().applyMatrix4(rest)
  const pose = (target: Vector3, from: Vector3, distance: number): ShotPose => ({
    target,
    position: target.clone().addScaledVector(from, distance),
  })
  const approach = leaf.shot.arrival.position.clone().sub(leaf.center).normalize()
  const leafUp = new Vector3(0, 1, 0).applyQuaternion(leaf.quaternion)
  const [d1, d2, d3, d4] = DISTANCES
  const poses = [
    pose(leaf.center.clone().addScaledVector(leafUp, -0.04), approach, d1),
    pose(world(new Vector3(0, -0.5 * C, 0.5 * C)), view, d2),
    pose(world(center), view, d3),
    pose(world(chloroplast), view, d4),
  ]
  return { local, rest, poses, turn, slot, chloroplast, axes: { F, R, U } }
}

export type LeafPlan = ReturnType<typeof leafPlan>
