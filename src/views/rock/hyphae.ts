import { CatmullRomCurve3, Matrix3, Mesh, MeshStandardMaterial, Raycaster, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../scene/tree'
import { rootFrame, type Site } from './frame'

export const HYPHA_RADIUS = 0.00018

export function createHyphae({ tip, direction, radius, stone }: Site) {
  const rand = mulberry32(5)
  const { radial } = rootFrame(direction)
  stone.updateWorldMatrix(true, false)
  const center = new Vector3().setFromMatrixPosition(stone.matrixWorld)
  const ray = new Raycaster()
  const onStone = (from: Vector3, toward: Vector3) => {
    ray.set(from, toward.clone().sub(from).normalize())
    return ray.intersectObject(stone)[0]
  }
  const startAt = (back: number, angle: number) =>
    tip.clone().addScaledVector(direction, -back).addScaledVector(radial(angle), radius * 1.3)
  const curveTo = (start: Vector3, end: Vector3, bend: number) => {
    const side = new Vector3().subVectors(end, start).cross(direction).normalize()
    const leave = start.clone().sub(tip).projectOnPlane(direction).normalize()
    const points = [start, start.clone().addScaledVector(leave, 0.01)]
    for (const t of [0.35, 0.65]) points.push(start.clone().lerp(end, t).addScaledVector(side, bend * (t < 0.5 ? 1 : -0.6)))
    return new CatmullRomCurve3([...points, end])
  }

  const start = startAt(0.07, Math.PI / 2)
  const contact = onStone(start, center)
  const normal = contact.face!.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(stone.matrixWorld)).normalize()
  const featured = curveTo(start, contact.point, 0.01)
  const curves = [featured]
  for (let i = 0; i < 18; i++) {
    const s = startAt(0.01 + 0.15 * rand(), Math.PI / 2 + (rand() - 0.5) * (i < 6 ? 1.6 : 5))
    if (i < 6) {
      const aim = center.clone().add(new Vector3(rand() - 0.5, 0.6, rand() - 0.5).multiply(stone.scale))
      const hit = onStone(s, aim)
      if (hit) curves.push(curveTo(s, hit.point, (rand() - 0.5) * 0.04))
      continue
    }
    const out = s.clone().sub(tip).projectOnPlane(direction).normalize()
    const length = 0.12 + 0.2 * rand()
    const end = s
      .clone()
      .addScaledVector(out, length * 0.8)
      .addScaledVector(direction, (rand() - 0.3) * length * 0.6)
      .add(new Vector3(0, -0.4 * length * rand(), 0))
    curves.push(curveTo(s, end, (rand() - 0.5) * 0.05))
  }
  const geometry = mergeGeometries(curves.map((c) => new TubeGeometry(c, 64, HYPHA_RADIUS, 5)))
  const material = new MeshStandardMaterial({ color: '#f6f1e4', roughness: 0.7, transparent: true, opacity: 0, userData: { opacity: 1 } })
  return {
    hyphae: new Mesh(geometry, material),
    featured,
    contact: contact.point,
    normal,
    hyphaPoint: curves[2].getPointAt(0.3),
    stonePoint: contact.point.clone().addScaledVector(normal, 0.01),
  }
}
