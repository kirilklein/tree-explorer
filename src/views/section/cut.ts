import { BufferAttribute, BufferGeometry, Plane, Vector3 } from 'three'
import { CEILING, FLOOR, type Frame, HALF_ANGLE, type Surface } from './frame'
import { layerNamed, layersOf } from './layers'

const ANGLES = 48
const HEIGHTS = 12
const INNER = 28
const OUTER = 10
const COLUMNS = INNER + OUTER + 1

export function createCut(frame: Frame, surface: Surface, radius: number) {
  const { a, at, dir } = frame
  const wood = layerNamed(layersOf(radius), 'Sapwood').outer
  const pieces = [
    { rows: ANGLES + 1, flip: true },
    { rows: ANGLES + 1, flip: false },
    { rows: HEIGHTS + 1, flip: true },
    { rows: HEIGHTS + 1, flip: false },
  ]
  const rows = pieces.reduce((sum, p) => sum + p.rows, 0)
  const position = new BufferAttribute(new Float32Array(rows * COLUMNS * 3), 3)
  const normal = new BufferAttribute(new Float32Array(rows * COLUMNS * 3), 3)
  const uv = new BufferAttribute(new Float32Array(rows * COLUMNS * 2), 2)
  const indices: number[] = []
  let first = 0
  for (const { rows: count, flip } of pieces) {
    for (let r = first; r < first + count - 1; r++) {
      for (let k = 0; k < COLUMNS - 1; k++) {
        const [p, q, s, t] = [r * COLUMNS + k, (r + 1) * COLUMNS + k, r * COLUMNS + k + 1, (r + 1) * COLUMNS + k + 1]
        indices.push(...(flip ? [p, s, q, q, s, t] : [p, q, s, q, t, s]))
      }
    }
    first += count
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', position)
  geometry.setAttribute('normal', normal)
  geometry.setAttribute('uv', uv)
  geometry.setIndex(indices)

  const fillRow = (row: number, phi: number, h: number, facing: Vector3) => {
    const origin = at(h)
    const out = dir(phi)
    const rim = surface(origin, out)
    for (let k = 0; k < COLUMNS; k++) {
      const outer = Math.max(0, k - INNER) / OUTER
      const rho = k <= INNER ? (wood * k) / INNER : wood + (rim - wood) * outer
      const u = k <= INNER ? rho / radius : wood / radius + (1 - wood / radius) * outer
      const i = row * COLUMNS + k
      const p = origin.clone().addScaledVector(out, rho)
      position.setXYZ(i, p.x, p.y, p.z)
      normal.setXYZ(i, facing.x, facing.y, facing.z)
      uv.setXY(i, u, 0.5)
    }
  }

  function update(open: number) {
    const alpha = HALF_ANGLE * open
    const down = a.clone().negate()
    let row = 0
    for (const [h, facing] of [[FLOOR, a], [CEILING, down]] as const) {
      for (let i = 0; i <= ANGLES; i++) fillRow(row++, -alpha + (2 * alpha * i) / ANGLES, h, facing)
    }
    for (const side of [1, -1]) {
      const facing = frame.n.clone().multiplyScalar(Math.sin(alpha)).addScaledVector(frame.s, -side * Math.cos(alpha))
      for (let j = 0; j <= HEIGHTS; j++) fillRow(row++, side * alpha, FLOOR + ((CEILING - FLOOR) * j) / HEIGHTS, facing)
    }
    position.needsUpdate = normal.needsUpdate = uv.needsUpdate = true
    geometry.computeBoundingSphere()
  }

  return { geometry, update }
}

export function cutPlanes({ a, n, s, at, center, radius }: Frame) {
  const planes = Array.from({ length: 5 }, () => new Plane())
  function update(open: number) {
    const alpha = HALF_ANGLE * open
    const [bottom, top, left, right, bound] = planes
    bottom.setFromNormalAndCoplanarPoint(a.clone().negate(), at(FLOOR))
    top.setFromNormalAndCoplanarPoint(a, at(CEILING))
    for (const [plane, side] of [[left, 1], [right, -1]] as const) {
      const normal = n.clone().multiplyScalar(-Math.sin(alpha)).addScaledVector(s, side * Math.cos(alpha))
      plane.setFromNormalAndCoplanarPoint(normal, center)
    }
    bound.setFromNormalAndCoplanarPoint(n, center.clone().addScaledVector(n, radius * 1.3))
  }
  update(0)
  return { planes, update }
}
