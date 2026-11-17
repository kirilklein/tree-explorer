import {
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from 'three'
import { mulberry32 } from '../../scene/tree'
import { rootFrame, type Site } from './frame'

const UP = new Vector3(0, 1, 0)

function rounded(radius: number, back: number, length: number) {
  const points = [new Vector2(radius, -back)]
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2)
    points.push(new Vector2(radius * Math.cos(a), length * Math.sin(a)))
  }
  return new LatheGeometry(points, 24)
}

const fading = (color: string, opacity = 1) =>
  new MeshStandardMaterial({ color, roughness: 0.8, transparent: true, opacity: 0, userData: { opacity } })

export function createTip({ tip, direction, radius }: Site) {
  const rand = mulberry32(11)
  const { toAxis, radial } = rootFrame(direction)

  const cap = new Mesh(rounded(radius * 1.01, 0.004, radius * 1.7), fading('#dcb98c'))
  const mantle = new Mesh(rounded(radius * 1.3, 0.16, radius * 2.1), fading('#efe7d4', 0.55))
  for (const mesh of [cap, mantle]) {
    mesh.position.copy(tip)
    mesh.quaternion.copy(toAxis)
  }

  const hairs = new InstancedMesh(new CylinderGeometry(0.0006, 0.0005, 1, 5).translate(0, 0.5, 0), fading('#f3ecdc'), 240)
  const m = new Matrix4()
  const q = new Quaternion()
  for (let i = 0; i < hairs.count; i++) {
    const back = 0.025 + 0.13 * rand()
    const out = radial(rand() * Math.PI * 2)
    const axis = out.clone().addScaledVector(direction, -0.3).add(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.3)).normalize()
    const base = tip.clone().addScaledVector(direction, -back).addScaledVector(out, radius * 0.95)
    const length = 0.006 + 0.022 * (back / 0.155) * (0.6 + 0.4 * rand())
    hairs.setMatrixAt(i, m.compose(base, q.setFromUnitVectors(UP, axis), new Vector3(1, length, 1)))
  }

  const grains = new InstancedMesh(new IcosahedronGeometry(1, 0), fading('#ffffff'), 28)
  const color = new Color()
  for (let i = 0; i < grains.count; i++) {
    const at = tip
      .clone()
      .addScaledVector(direction, 0.04 - 0.2 * rand())
      .addScaledVector(radial(rand() * Math.PI * 2), radius + 0.012 + 0.03 * rand())
    const size = 0.0015 + 0.003 * rand()
    grains.setMatrixAt(i, m.compose(at, q.random(), new Vector3(size, size * (0.6 + 0.4 * rand()), size)))
    grains.setColorAt(i, color.setHSL(0.07 + 0.04 * rand(), 0.35, 0.3 + 0.2 * rand()))
  }

  return {
    cap,
    mantle,
    hairs,
    grains,
    capPoint: tip.clone().addScaledVector(direction, radius * 1.7),
    hairPoint: tip.clone().addScaledVector(direction, -0.12).addScaledVector(radial(-Math.PI / 2), radius + 0.02),
    mantlePoint: tip.clone().addScaledVector(direction, -0.03).addScaledVector(radial(Math.PI), radius * 1.3),
  }
}
