import { CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, Object3D, Plane, Quaternion, SphereGeometry, Vector3 } from 'three'
import { C } from './frame'
import { paint, smooth } from './paint'

const SIZE = new Vector3(0.11 * C, 0.17 * C, 0.07 * C)
const STACKS = [5, 7, 6, 7, 5]

export function createChloroplast() {
  const plane = new Plane()
  const cut = new Plane(new Vector3(0, 0, -1), SIZE.z * 1.2)
  const geometry = new SphereGeometry(1, 40, 28)
  const outer = new Mesh(geometry, paint('#3c8a36', { side: DoubleSide, clippingPlanes: [plane] }))
  outer.scale.copy(SIZE)
  const inner = new Mesh(geometry, paint('#9ccc78', { side: DoubleSide, clippingPlanes: [plane] }))
  inner.scale.copy(SIZE).multiplyScalar(0.9)

  const discs = new InstancedMesh(
    new CylinderGeometry(0.026 * C, 0.026 * C, 0.008 * C, 20).rotateZ(Math.PI / 2),
    paint('#2b7a2e', { emissiveIntensity: 0.45 }),
    STACKS.reduce((a, b) => a + b),
  )
  const m = new Matrix4()
  const q = new Quaternion()
  const one = new Vector3(1, 1, 1)
  let i = 0
  STACKS.forEach((n, s) => {
    for (let d = 0; d < n; d++) discs.setMatrixAt(i++, m.compose(new Vector3((d - (n - 1) / 2) * 0.012 * C, (s - 2) * 0.04 * C, -0.008 * C), q, one))
  })
  const lamella = new CylinderGeometry(0.003 * C, 0.003 * C, 0.2 * C, 6)
  const lamellaMaterial = paint('#4f9a45')
  const lamellae = [-0.012, 0.012].map((x) => new Mesh(lamella, lamellaMaterial).translateX(x * C).translateZ(-0.008 * C))

  const group = new Group().add(outer, inner, discs, ...lamellae)
  const point = (x: number, y: number, z: number) => {
    const o = new Object3D()
    o.position.set(x, y, z)
    group.add(o)
    return o
  }
  return {
    group,
    labels: { envelope: point(-SIZE.x * 0.95, SIZE.y * 0.3, 0), stacks: point(0.03 * C, 0.04 * C, -0.008 * C) },
    update(open: number) {
      cut.constant = SIZE.z * 1.2 * (1 - smooth(open))
    },
    clip() {
      plane.copy(cut).applyMatrix4(group.matrixWorld)
    },
  }
}
