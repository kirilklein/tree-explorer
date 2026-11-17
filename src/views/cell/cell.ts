import {
  CapsuleGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import { createChloroplast } from './chloroplast'
import { C } from './frame'
import { paint, smooth } from './paint'
import { CELL, type LeafPlan, SLIDE, STACK } from './poses'
import { PALISADE } from './tissue'

const PULL = 1.6 * C
const RINGS = [0, 0.55, -0.55]

const shell = (color: string, opacity: number, order: number, geometry: CapsuleGeometry) => {
  const mesh = new Mesh(geometry, paint(color, { transparent: true, depthWrite: false, side: DoubleSide, opacity }))
  mesh.renderOrder = order
  return mesh
}

function anchor(parent: Object3D, y: number) {
  const point = new Object3D()
  point.position.y = y
  parent.add(point)
  return point
}

export function createCell({ turn, slot }: LeafPlan) {
  const wall = shell(PALISADE.color, 1, 3, new CapsuleGeometry(PALISADE.radius, PALISADE.length, 6, 16))
  const membrane = shell('#f1d98c', 0.4, 2, new CapsuleGeometry(0.38 * C, 1.5 * C, 6, 16))
  const vacuole = shell('#a6d4f0', 0.5, 1, new CapsuleGeometry(0.21 * C, 1.1 * C, 6, 16))
  vacuole.position.y = -0.1 * C
  const nucleus = new Mesh(new SphereGeometry(0.15 * C, 24, 16), paint('#8d6cc0'))
  nucleus.position.y = 0.92 * C

  const ring = RINGS.flatMap((h, r) =>
    Array.from({ length: 5 }, (_, k) => ({ h: h * C, angle: Math.PI / 2 + (r ? Math.PI / 5 : 0) + (k * 2 * Math.PI) / 5 })),
  )
  const featured = createChloroplast()
  const plastids = new InstancedMesh(new SphereGeometry(1, 16, 12), paint('#3c8a36'), ring.length - 1)
  const chloroplasts = new Group().add(plastids, featured.group)
  const mitochondria = new InstancedMesh(new CapsuleGeometry(0.05 * C, 0.13 * C, 4, 10), paint('#e0864a'), 5)
  const m = new Matrix4()
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  for (let k = 0; k < mitochondria.count; k++) {
    const a = Math.PI / 2 + Math.PI / 5 + (k * 2 * Math.PI) / 5
    const at = new Vector3(Math.cos(a) * 0.3 * C, [0, 0.2, -0.2, 0.2, -0.2][k] * C, Math.sin(a) * 0.3 * C)
    mitochondria.setMatrixAt(k, m.compose(at, q.setFromAxisAngle(up, a), new Vector3(1, 1, 1)))
  }

  const parts = (
    [
      [wall, STACK.wall],
      [membrane, STACK.membrane],
      [chloroplasts, STACK.chloroplasts],
      [vacuole, STACK.vacuole],
      [nucleus, STACK.nucleus],
      [mitochondria, STACK.mitochondria],
    ] as const
  ).map(([object, row], i) => ({ object, home: object.position.clone(), slot: slot(row), delay: i * 0.05 }))
  const group = new Group().add(...parts.map((p) => p.object))
  group.position.copy(CELL)
  const plastidScale = new Vector3(0.11 * C, 0.17 * C, 0.07 * C)
  const identity = new Quaternion()

  return {
    group,
    labels: {
      wall: anchor(wall, 1.2 * C),
      membrane: anchor(membrane, 1.13 * C),
      chloroplasts: anchor(chloroplasts, 0.75 * C),
      vacuole: anchor(vacuole, 0.76 * C),
      nucleus: anchor(nucleus, 0.15 * C),
      mitochondria: anchor(mitochondria, 0.35 * C),
      ...featured.labels,
    },
    clip: featured.clip,
    update(apart: number, open: number) {
      const out = smooth(apart / 0.4)
      for (const { object, home, slot: to, delay } of parts) {
        const k = smooth((apart - 0.3 - delay) / 0.45)
        object.position.copy(home).setZ(home.z + PULL * out).lerp(to, k)
        object.quaternion.slerpQuaternions(identity, turn, k)
      }
      ;(wall.material as Material).opacity = 1 - 0.74 * out + 0.34 * smooth((apart - 0.3) / 0.45)
      const r = (0.4 - 0.1 * out) * C
      ring.slice(1).forEach(({ h, angle }, i) => {
        const at = new Vector3(Math.cos(angle) * r, h, Math.sin(angle) * r)
        plastids.setMatrixAt(i, m.compose(at, q.setFromAxisAngle(up, Math.PI / 2 - angle), plastidScale))
      })
      plastids.instanceMatrix.needsUpdate = true
      featured.group.position.set(0, 0, r + SLIDE * smooth(open))
      featured.update(open)
    },
  }
}
