import {
  type BufferGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../scene/tree'
import { C } from './frame'
import { fade, paint, smooth } from './paint'
import type { LeafPlan } from './poses'

const COUNT = 8
const LOOP_SECONDS = 5

const atoms = (radius: number, offsets: number[]) =>
  mergeGeometries(offsets.map((x) => new SphereGeometry(radius, 12, 8).translate(x, 0, 0)))

export function createStreams({ chloroplast, axes: { R, U, F } }: LeafPlan) {
  const rand = mulberry32(23)
  const at = (r: number, u: number) => chloroplast.clone().addScaledVector(R, r * C).addScaledVector(U, u * C).addScaledVector(F, 0.03 * C)
  const stream = (geometry: BufferGeometry, color: string, from: Vector3, to: Vector3, glow = 0.3) => {
    const mesh = new InstancedMesh(geometry, paint(color, { emissiveIntensity: glow, transparent: true }), COUNT)
    return { mesh, from, to, turns: Array.from({ length: COUNT }, () => new Quaternion().random()) }
  }
  const streams = [
    stream(new CylinderGeometry(0.004 * C, 0.004 * C, 0.07 * C, 6), '#ffe27a', at(-0.22, 0.48), at(-0.05, 0.02), 1),
    stream(atoms(0.012 * C, [-0.022 * C, 0, 0.022 * C]), '#8c9099', at(-0.55, 0.08), at(-0.08, 0)),
    stream(new SphereGeometry(0.016 * C, 14, 10), '#4aa3e8', at(-0.4, -0.4), at(-0.06, -0.03)),
    stream(new CylinderGeometry(0.02 * C, 0.02 * C, 0.008 * C, 6).rotateX(Math.PI / 2), '#f2a33b', at(0.06, -0.02), at(0.5, -0.32)),
    stream(atoms(0.013 * C, [-0.012 * C, 0.012 * C]), '#e2574c', at(0.05, 0.03), at(0.45, 0.36)),
  ]
  const offsets = streams.map(() => rand())
  const along = new Quaternion()
  const m = new Matrix4()
  const p = new Vector3()
  const s = new Vector3()
  let time = 0
  return {
    group: new Group().add(...streams.map((x) => x.mesh)),
    update(dt: number, shown: number) {
      time += dt
      streams.forEach(({ mesh, from, to, turns }, j) => {
        along.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize())
        for (let i = 0; i < COUNT; i++) {
          const t = (time / LOOP_SECONDS + i / COUNT + offsets[j]) % 1
          p.lerpVectors(from, to, t)
          s.setScalar(smooth(t * 6) * smooth((1 - t) * 6))
          mesh.setMatrixAt(i, m.compose(p, j === 0 ? along : turns[i], s))
        }
        mesh.instanceMatrix.needsUpdate = true
      })
      fade(
        streams.map((x) => x.mesh),
        shown,
      )
    },
  }
}
