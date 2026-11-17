import { Matrix4, Vector3 } from 'three'
import type { Leaf } from '../../scene/tree'
import { windAmount, windTime } from '../../scene/wind'

const shear = new Matrix4()
const offset = new Vector3()
const scale = new Vector3()

export function swayMatrix(leaf: Leaf, phase: number, out: Matrix4, amount = 1) {
  const t = windTime.value
  const w = windAmount.value * amount
  const p = leaf.position
  const gust = 0.6 + 0.4 * Math.sin(t * 0.19) * Math.sin(t * 0.11 + 1.7)
  const bend = Math.max(p.y, 0) ** 2 * 0.0011 * gust * (0.7 + 0.3 * Math.sin(t * 0.8))
  const local = leaf.sway * 0.012 * gust
  const at = p.x * 0.21 + p.y * 0.13 + p.z * 0.17
  offset
    .set(
      bend + local * Math.sin(t * 1.7 + at),
      0.4 * local * Math.sin(t * 2.3 + at * 1.3),
      0.35 * bend + 0.7 * local * Math.sin(t * 1.3 + at * 0.8),
    )
    .multiplyScalar(w)
    .add(p)
  const flutter = w * Math.sin(t * 5 + phase) * 0.12 * gust
  shear.set(1, 0, 0, 0, 0, 1, 0, 0, 0, flutter, 1, 0, 0, 0, 0, 1)
  return out.compose(offset, leaf.quaternion, scale.setScalar(leaf.scale)).multiply(shear)
}
