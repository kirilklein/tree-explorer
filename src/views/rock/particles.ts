import {
  BoxGeometry,
  type CatmullRomCurve3,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mulberry32 } from '../../scene/tree'
import { HYPHA_RADIUS } from './hyphae'

const LOOP_SECONDS = 6
const smooth = (x: number) => Math.min(1, Math.max(0, x)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, x)))
const material = (color: string) =>
  new MeshStandardMaterial({ color, roughness: 0.5, transparent: true, opacity: 0, userData: { opacity: 1 } })

export function createParticles(featured: CatmullRomCurve3, contact: Vector3, normal: Vector3) {
  const rand = mulberry32(3)
  const length = featured.getLength()
  const end = (from: number) => featured.getPointAt(1 - from / length)
  const across = new Vector3().crossVectors(normal, featured.getTangentAt(1)).normalize()
  const along = new Vector3().crossVectors(across, normal)
  const onSurface = () =>
    contact.clone().addScaledVector(across, (rand() - 0.5) * 0.004).addScaledVector(along, (rand() - 0.5) * 0.004)

  const oxalate = new InstancedMesh(new SphereGeometry(0.00008, 8, 6), material('#8fdc6a'), 24)
  const calcium = new InstancedMesh(new SphereGeometry(0.00008, 8, 6), material('#ffffff'), 24)
  const crystals = new InstancedMesh(new OctahedronGeometry(1), material('#e4f0ff'), 36)
  const minerals = new InstancedMesh(new BoxGeometry(0.0004, 0.0004, 0.0004), material('#3f9be0'), 40)
  const sugars = new InstancedMesh(new SphereGeometry(0.00026, 10, 8), material('#f2a93b'), 40)

  const paths = (count: number, outward: boolean) =>
    Array.from({ length: count }, () => {
      const hypha = end(0.0005 + 0.006 * rand())
      const stone = onSurface()
      return { from: outward ? hypha : stone, to: outward ? stone : hypha, offset: rand() }
    })
  const oxalatePaths = paths(oxalate.count, true)
  const calciumPaths = paths(calcium.count, false)
  const crystalSites = Array.from({ length: crystals.count }, () => {
    const back = 0.0004 + 0.007 * rand()
    const angle = rand() * Math.PI * 2
    const out = across.clone().multiplyScalar(Math.cos(angle)).addScaledVector(normal, Math.sin(angle))
    const size = 0.00012 + 0.00016 * rand()
    return { at: end(back).addScaledVector(out, HYPHA_RADIUS + size * 0.5), size, turn: new Quaternion().random() }
  })

  const m = new Matrix4()
  const q = new Quaternion()
  const v = new Vector3()
  const one = new Vector3(1, 1, 1)
  let time = 0

  function update(dt: number) {
    time += dt
    const phase = (time % LOOP_SECONDS) / LOOP_SECONDS
    for (const [mesh, list] of [[oxalate, oxalatePaths], [calcium, calciumPaths]] as const) {
      list.forEach(({ from, to, offset }, i) => {
        const t = (phase * 3 + offset) % 1
        mesh.setMatrixAt(i, m.compose(v.lerpVectors(from, to, t), q, one.setScalar(smooth(t * 6) * smooth((1 - t) * 6))))
      })
      mesh.instanceMatrix.needsUpdate = true
    }
    const fade = smooth((1 - phase) * 12)
    crystalSites.forEach(({ at, size, turn }, i) => {
      const grown = smooth(phase * crystals.count * 1.15 - i) * fade
      crystals.setMatrixAt(i, m.compose(at, turn, one.setScalar(size * grown)))
    })
    crystals.instanceMatrix.needsUpdate = true
    for (const [mesh, sign] of [[minerals, -1], [sugars, 1]] as const) {
      for (let i = 0; i < mesh.count; i++) {
        const u = (((time * 0.012) / length) * sign + i / mesh.count + 10) % 1
        const p = featured.getPointAt(u)
        const side = featured.getTangentAt(u).cross(normal).normalize().multiplyScalar(sign * HYPHA_RADIUS * 0.9)
        mesh.setMatrixAt(i, m.compose(p.add(side), q, one.setScalar(1)))
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  }
  update(0)

  return {
    contactParts: [oxalate, calcium, crystals],
    streamParts: [minerals, sugars],
    update,
    oxalatePoint: oxalatePaths[0].from.clone().lerp(oxalatePaths[0].to, 0.85),
    crystalPoint: end(0.002),
    mineralPoint: featured.getPointAt(0.84),
    sugarPoint: featured.getPointAt(0.76),
  }
}
