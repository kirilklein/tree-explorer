import { type BufferGeometry, Matrix4, Vector3 } from 'three'
import type { Sites } from '../../scene/sites'

export type LeafSite = Sites['leaf']

export const C = 0.0003
export const NOTCH = { half: 6 * C, depth: 4 * C }
export const BLOCK = { half: 10 * C, back: 6 * C }
export const COLS = 5
export const ROWS = 8

const ROW = 6
const EDGE = 4

export function sectionFrame(leaf: LeafSite, geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const at = (row: number, col: number) => new Vector3().fromBufferAttribute(position, row * COLS + col)
  const a = at(ROW, EDGE)
  const b = at(ROW + 1, EDGE)
  const inner = at(ROW + 1, EDGE - 1)
  const up = inner.clone().sub(b).cross(a.clone().sub(b)).normalize()
  if (up.dot(new Vector3().fromBufferAttribute(geometry.getAttribute('normal'), ROW * COLS + EDGE)) < 0) up.negate()
  const out = b.clone().sub(a).cross(up).normalize()
  if (out.dot(a.clone().sub(inner)) < 0) out.negate()
  const x = new Vector3().crossVectors(up, out)
  const origin = a.lerp(b, 0.5).addScaledVector(out, -NOTCH.depth / leaf.scale)
  const local = new Matrix4().makeBasis(x, up, out).setPosition(origin).scale(new Vector3().setScalar(1 / leaf.scale))
  const rest = new Matrix4().compose(leaf.position, leaf.quaternion, new Vector3().setScalar(leaf.scale)).multiply(local)
  return { local, rest }
}
