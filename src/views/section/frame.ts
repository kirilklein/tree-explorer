import { type BufferGeometry, Ray, Triangle, Vector3 } from 'three'
import type { Sites } from '../../scene/sites'

export const FLOOR = -0.18
export const CEILING = 0.18
export const HALF_ANGLE = 0.7

export function trunkFrame({ point, normal, axis, radius }: Sites['trunk']) {
  const a = axis.clone()
  const n = normal.clone().projectOnPlane(a).normalize()
  const s = new Vector3().crossVectors(a, n)
  const center = point.clone().addScaledVector(normal, -radius)
  const at = (h: number) => center.clone().addScaledVector(a, h)
  const dir = (phi: number) => n.clone().multiplyScalar(Math.cos(phi)).addScaledVector(s, Math.sin(phi))
  return { a, n, s, center, radius, at, dir, point: (phi: number, rho: number, h: number) => at(h).addScaledVector(dir(phi), rho) }
}

export type Frame = ReturnType<typeof trunkFrame>

export type Surface = (origin: Vector3, direction: Vector3) => number

export function surfaceOf(wood: BufferGeometry, { center, a, radius }: Frame): Surface {
  const position = wood.getAttribute('position')
  const index = wood.index!
  const near = (p: Vector3) => {
    const d = p.clone().sub(center)
    const h = d.dot(a)
    return Math.abs(h) < 1 && d.addScaledVector(a, -h).length() < radius * 1.5
  }
  const triangles: Triangle[] = []
  for (let i = 0; i < index.count; i += 3) {
    const t = new Triangle(...[0, 1, 2].map((k) => new Vector3().fromBufferAttribute(position, index.getX(i + k))))
    if ([t.a, t.b, t.c].some(near)) triangles.push(t)
  }
  const ray = new Ray()
  const hit = new Vector3()
  return (origin, direction) => {
    ray.origin.copy(origin).addScaledVector(direction, 1)
    ray.direction.copy(direction).negate()
    let nearest = Infinity
    for (const t of triangles) {
      if (ray.intersectTriangle(t.a, t.b, t.c, false, hit)) nearest = Math.min(nearest, ray.origin.distanceTo(hit))
    }
    return 1 - nearest
  }
}
